<?php
declare(strict_types=1);
/**
 * Automated, idempotent tenant migration for the SHARED app DB.
 *
 * Replaces the manual schema/tenant migration passes for Docker/CI: it
 *   1. creates missing base and reconciliation module tables,
 *   2. adds `tenant_id INT NOT NULL DEFAULT 1` (+ index) to every base business
 *      table that doesn't have it (existing rows backfill to the founding tenant
 *      via the DEFAULT),
 *   3. widens `document_sequences` PK to (tenant_id, doc_type, period) so tenants
 *      don't share running document numbers (migration 002), and
 *   4. applies idempotent feature and historical reconciliation schemas.
 *
 * Safe to run repeatedly. Reads DB creds from env (DB_HOST/DB_NAME/DB_USER/DB_PASS).
 * Run:  php database/migrate.php
 */

$host = getenv('DB_HOST') ?: '127.0.0.1';
$port = (int)(getenv('DB_PORT') ?: 3306);
$name = getenv('DB_NAME') ?: 'saas_app';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: '';

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

$pdo = connect($host, $port, $name, $user, $pass);
fwrite(STDOUT, "[migrate] connected to $name@$host\n");

// ── Base module schemas (must run BEFORE the tenant_id backfill) ────────────
// Procurement + Smart-Inventory base tables aren't present in every tenant's
// seed dump. Create them here so (1) the tenant_id loop below stamps them and
// (2) the *_extra / *_adv feature schemas can extend them. All use
// CREATE TABLE IF NOT EXISTS, so this is safe to re-run.
$baseSchemas = [
    'create_procurement_phase1.sql',
    'create_procurement_phase2_inventory.sql',
    'create_smart_inventory.sql',
];
foreach ($baseSchemas as $file) {
    $path = __DIR__ . '/' . $file;
    if (!is_file($path)) { fwrite(STDOUT, "[migrate] base schema missing: $file\n"); continue; }
    $sql = (string) file_get_contents($path);
    if (trim($sql) === '') continue;
    try {
        $stmt = $pdo->query($sql);
        if ($stmt !== false) { do { /* drain */ } while ($stmt->nextRowset()); }
        fwrite(STDOUT, "[migrate] applied base schema: $file\n");
    } catch (Throwable $e) {
        fwrite(STDERR, "[migrate] WARN base schema $file: {$e->getMessage()}\n");
    }
}

// ── Reconciliation table schemas (also before tenant_id backfill) ───────────
// These files were historically run by hand and were not part of migrate.php.
// Dependency order is intentional: attachments and document sequences precede
// sales billing, column additions precede their indexes, and the generic
// tenant_id pass below scopes every newly-created business table.
$preTenantSchemas = [
    'create_attachments.sql',
    'create_document_sequences.sql',
    'create_quotation_builder.sql',
    'create_component_library.sql',
    'create_sales_billing_phase1.sql',
    'create_dealer_customer_intelligence.sql',
    'create_finance_planning.sql',
    'create_hr_compliance_media.sql',
    'create_data_interop_backups.sql',
    'create_import_jobs.sql',
    'add_invoice_payment_status.sql',
    'add_invoice_pdf_fields.sql',
    'add_invoice_products.sql',
    'add_unit_to_invoice_items.sql',
    'add_discount_to_invoice_items.sql',
    'add_po_fields.sql',
    'add_sop_document_uploads.sql',
    'add_tms_tasks.sql',
    'add_user_staff_role.sql',
    'split_customer_address.sql',
    'add_performance_indexes.sql',
];
foreach ($preTenantSchemas as $file) {
    $path = __DIR__ . '/' . $file;
    if (!is_file($path)) { fwrite(STDOUT, "[migrate] pre-tenant schema skipped (missing): $file\n"); continue; }
    $sql = (string) file_get_contents($path);
    if (trim($sql) === '') continue;
    try {
        $stmt = $pdo->query($sql);
        if ($stmt !== false) { do { /* drain result sets */ } while ($stmt->nextRowset()); }
        fwrite(STDOUT, "[migrate] applied pre-tenant schema: $file\n");
    } catch (Throwable $e) {
        fwrite(STDERR, "[migrate] WARN pre-tenant schema $file: {$e->getMessage()}\n");
    }
}

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

// ── Feature schemas (idempotent) ───────────────────────────────────────────
// Module tables/columns that are NOT in the base seed dump. Every file is guarded
// (CREATE TABLE IF NOT EXISTS / information_schema-gated ALTERs), so this is safe
// to run repeatedly. Multi-statement files (PREPARE/EXECUTE) are run via query()
// with the result sets drained through nextRowset().
$featureSchemas = [
    'create_crm_tables.sql',
    'create_quotes_extra.sql',
    'create_invoicing_extra.sql',
    'create_procurement_extra.sql',
    'create_chat_extra.sql',
    'create_customers_extra.sql',
    'create_orders_extra.sql',
    'create_payroll_extra.sql',
    'create_workflows_extra.sql',
    'create_waveB_extra.sql',
    'create_accounting.sql',
    'create_hr_leave.sql',
    'create_expense_claims.sql',
    'create_invoicing_adv.sql',
    'create_products_adv.sql',
    'create_inventory_adv.sql',
    'create_vendor_credits.sql',
    'create_rbac.sql',
    'create_sales_module.sql',
];
foreach ($featureSchemas as $file) {
    $path = __DIR__ . '/' . $file;
    if (!is_file($path)) { fwrite(STDOUT, "[migrate] feature schema skipped (missing): $file\n"); continue; }
    $sql = (string) file_get_contents($path);
    if (trim($sql) === '') continue;
    try {
        $stmt = $pdo->query($sql);
        if ($stmt !== false) { do { /* drain result sets */ } while ($stmt->nextRowset()); }
        fwrite(STDOUT, "[migrate] applied feature schema: $file\n");
    } catch (Throwable $e) {
        fwrite(STDERR, "[migrate] WARN feature schema $file: {$e->getMessage()}\n");
    }
}

// ── Reconciliation columns and indexes (idempotent) ────────────────────────
fwrite(STDOUT, "[migrate] complete.\n");
