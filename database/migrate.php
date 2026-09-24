<?php
declare(strict_types=1);
/**
 * Automated, idempotent tenant migration for the SHARED app DB.
 *
 *   php database/migrate.php
 *
 * Applies every database/NNN_*.sql in number order, on every run:
 *   001–099  base and reconciliation tables that must exist BEFORE the tenant pass
 *   (tenant pass) adds `tenant_id INT NOT NULL DEFAULT 1` (+ index) to every
 *            business table missing it (existing rows backfill to the founding
 *            tenant via the DEFAULT), widens the `document_sequences` PK to
 *            (tenant_id, doc_type, period), and re-scopes single-column natural
 *            UNIQUE keys to (tenant_id, col)
 *   100+     feature schemas that extend those tables
 *
 * Every file is guarded (CREATE TABLE IF NOT EXISTS / information_schema-gated
 * ALTERs), so re-running is safe; a file that fails is reported as WARN and the
 * run continues. To add a migration, add the next free number — below 100 only
 * if the tenant pass must stamp a table it creates.
 *
 * database/legacy/ holds scripts that were run by hand (setup snapshots, one-off
 * fixes, credential resets). This runner never touches them.
 *
 * Credentials: DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS from the
 * environment, else from the project-root .env (the file the API reads).
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$env = [];
$envFile = dirname(__DIR__) . '/.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
        [$k, $v] = array_map('trim', explode('=', $line, 2));
        $env[$k] = trim($v, "\"'");
    }
}
$cfg = fn(string $k, string $d) => (getenv($k) !== false && getenv($k) !== '') ? (string)getenv($k) : (($env[$k] ?? '') !== '' ? $env[$k] : $d);

$host = $cfg('DB_HOST', '127.0.0.1');
$port = (int)$cfg('DB_PORT', '3306');
$name = $cfg('DB_NAME', 'saas_app');
$user = $cfg('DB_USER', 'root');
$pass = $cfg('DB_PASS', '');

// Tables that stay GLOBAL (never tenant-scoped) — must match TenantScope::GLOBAL_TABLES
// plus auth/session plumbing. We simply skip adding tenant_id to these.
$GLOBAL_TABLES = [
    'revoked_tokens', 'refresh_tokens', 'rate_limits', 'password_resets',
    'otp_verifications', 'migrations', 'schema_migrations',
    // control-plane tables never live in the app DB, but guard anyway:
    'plans', 'tenants', 'tenant_connections', 'subscriptions',
    'billing_invoices', 'billing_payments', 'platform_admins', 'platform_audit',
];

function connect(string $host, int $port, string $name, string $user, string $pass): PDO
{
    $dsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";
    $tries = 0;
    while (true) {
        try {
            return new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } catch (PDOException $e) {
            if (++$tries >= 30) { fwrite(STDERR, "[migrate] cannot connect: {$e->getMessage()}\n"); exit(1); }
            fwrite(STDOUT, "[migrate] waiting for DB ($tries)...\n");
            sleep(2);
        }
    }
}

/**
 * Run one schema file. Multi-statement files (PREPARE/EXECUTE) go through query()
 * with every result set drained, so the next file starts on a clean connection.
 */
function applySchema(PDO $pdo, string $path): void
{
    $file = basename($path);
    $sql = (string) file_get_contents($path);
    if (trim($sql) === '') return;
    try {
        $stmt = $pdo->query($sql);
        if ($stmt !== false) { do { /* drain result sets */ } while ($stmt->nextRowset()); }
        fwrite(STDOUT, "[migrate] applied $file\n");
    } catch (Throwable $e) {
        fwrite(STDERR, "[migrate] WARN $file: {$e->getMessage()}\n");
    }
}

$pdo = connect($host, $port, $name, $user, $pass);
fwrite(STDOUT, "[migrate] connected to $name@$host\n");

$files = glob(__DIR__ . '/[0-9][0-9][0-9]_*.sql') ?: [];
sort($files, SORT_STRING);
$beforeTenant = array_filter($files, fn($f) => (int)substr(basename($f), 0, 3) < 100);
$afterTenant  = array_filter($files, fn($f) => (int)substr(basename($f), 0, 3) >= 100);

// ── 001–099: tables the tenant pass must see ────────────────────────────────
// Procurement + Smart-Inventory base tables aren't present in every tenant's
// seed dump, so they come first; then the historically hand-run reconciliation
// schemas, in dependency order (attachments and document sequences precede
// sales billing, column additions precede their indexes).
foreach ($beforeTenant as $path) applySchema($pdo, $path);

// ── Tenant pass ──────────────────────────────────────────────────────────────
/** All base tables in this schema. */
$tables = $pdo->query(
    "SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
       AND TABLE_NAME NOT LIKE 'v\\_%'"
)->fetchAll(PDO::FETCH_COLUMN);

/** Tables already carrying tenant_id. */
$haveTenant = $pdo->query(
    "SELECT TABLE_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'tenant_id'"
)->fetchAll(PDO::FETCH_COLUMN);
$haveTenant = array_flip(array_map('strtolower', $haveTenant));

$added = 0; $skipped = 0;
foreach ($tables as $t) {
    $lt = strtolower($t);
    if (in_array($lt, $GLOBAL_TABLES, true)) { $skipped++; continue; }
    if (isset($haveTenant[$lt])) { $skipped++; continue; }
    $idx = 'idx_' . substr($lt, 0, 50) . '_tenant';
    $pdo->exec("ALTER TABLE `$t`
                ADD COLUMN `tenant_id` INT NOT NULL DEFAULT 1 FIRST,
                ADD INDEX `$idx` (`tenant_id`)");
    fwrite(STDOUT, "[migrate] + tenant_id on `$t`\n");
    $added++;
}
fwrite(STDOUT, "[migrate] tenant_id: added=$added, skipped=$skipped\n");

// ── Migration 002: widen document_sequences PK to include tenant_id ──────────
try {
    $seqExists = $pdo->query(
        "SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_sequences'"
    )->fetchColumn();
    if ($seqExists) {
        // Is tenant_id already part of the primary key?
        $pkHasTenant = $pdo->query(
            "SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_sequences'
               AND INDEX_NAME = 'PRIMARY' AND COLUMN_NAME = 'tenant_id'"
        )->fetchColumn();
        if (!$pkHasTenant) {
            $pdo->exec("ALTER TABLE `document_sequences`
                        DROP PRIMARY KEY,
                        ADD PRIMARY KEY (`tenant_id`, `doc_type`, `period`)");
            fwrite(STDOUT, "[migrate] document_sequences PK widened to (tenant_id, doc_type, period)\n");
        }
    }
} catch (Throwable $e) {
    fwrite(STDERR, "[migrate] WARN document_sequences PK: {$e->getMessage()} (adjust columns in 002 if names differ)\n");
}

// ── Widen single-column UNIQUE keys to (tenant_id, col) ──────────────────────
// Natural keys from the single-tenant origin (e.g. settings.setting_key,
// invoices.invoice_number) are globally unique, which breaks multi-tenancy:
// two tenants can't reuse a value, and ON DUPLICATE KEY UPDATE can hit another
// tenant's row. Re-scope them per tenant. Idempotent + safe (no-op if absent).
function singleColUnique(PDO $pdo, string $table, string $col): ?string
{
    $st = $pdo->prepare(
        "SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols, MAX(NON_UNIQUE) AS nu
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         GROUP BY INDEX_NAME"
    );
    $st->execute([$table]);
    foreach ($st->fetchAll() as $r) {
        if ($r['INDEX_NAME'] !== 'PRIMARY' && (int)$r['nu'] === 0 && $r['cols'] === $col) {
            return $r['INDEX_NAME'];
        }
    }
    return null;
}

$naturalKeys = [
    'settings'         => 'setting_key',
    'vendors'          => 'vendor_code',
    'invoices'         => 'invoice_number',
    'sales_documents'  => 'document_number',
    'purchase_orders'  => 'po_number',
    'expenses'         => 'expense_code',
    'employees'        => 'employee_key',
    'customer_metrics' => 'customer_id',
];
foreach ($naturalKeys as $table => $col) {
    try {
        // table + tenant_id must exist
        $hasCol = $pdo->prepare(
            "SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'tenant_id'"
        );
        $hasCol->execute([$table]);
        if (!$hasCol->fetchColumn()) continue;

        $idx = singleColUnique($pdo, $table, $col);
        if ($idx) {
            $new = 'uq_' . substr($table, 0, 40) . '_t_' . substr($col, 0, 20);
            $pdo->exec("ALTER TABLE `$table` DROP INDEX `$idx`, ADD UNIQUE KEY `$new` (`tenant_id`, `$col`)");
            fwrite(STDOUT, "[migrate] widened UNIQUE `$table`($col) -> (tenant_id, $col)\n");
        }
    } catch (Throwable $e) {
        fwrite(STDERR, "[migrate] WARN unique key $table.$col: {$e->getMessage()}\n");
    }
}

// ── 100+: feature schemas ───────────────────────────────────────────────────
// Module tables/columns that are NOT in the base seed dump and extend the
// tables above (the sales add_* files run after 118_create_sales_module.sql,
// which creates the tables they alter).
foreach ($afterTenant as $path) applySchema($pdo, $path);

fwrite(STDOUT, "[migrate] complete.\n");
