<?php
declare(strict_types=1);
/**
 * Idempotent column additions for the sales module.
 *
 *   php database/migrate_sales_tasks.php
 *
 * Creates the new tables from create_sales_tasks.sql and adds the columns the
 * release needs on three existing tables. Columns are added one at a time
 * behind an information_schema check rather than `ADD COLUMN IF NOT EXISTS`,
 * which MySQL does not support — the same script then runs on MySQL and
 * MariaDB, and re-running it is a no-op.
 *
 * Reads DB credentials from the environment, falling back to api/.env so it can
 * be run on the server the same way as the other maintenance scripts.
 */

$root = dirname(__DIR__);

/** Minimal .env reader — the app's own loader is not available standalone. */
function envFromFile(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $out = [];
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $line, 2);
        $out[trim($k)] = trim(trim($v), "\"'");
    }
    return $out;
}

$env  = envFromFile($root . '/api/.env') + envFromFile($root . '/.env');
$get  = static fn(string $k, string $default = '') => (string)(getenv($k) ?: ($env[$k] ?? $default));

$host = $get('DB_HOST', '127.0.0.1');
$port = (int)($get('DB_PORT', '3306'));
$name = $get('DB_NAME');
$user = $get('DB_USER');
$pass = $get('DB_PASS');

if ($name === '' || $user === '') {
    fwrite(STDERR, "[tasks] no database credentials found (DB_NAME/DB_USER)\n");
    exit(1);
}

$pdo = new PDO(
    "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4",
    $user,
    $pass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

// ── 1. New tables ───────────────────────────────────────────────────────────
$sqlFile = __DIR__ . '/create_sales_tasks.sql';
if (!is_file($sqlFile)) {
    fwrite(STDERR, "[tasks] create_sales_tasks.sql is missing\n");
    exit(1);
}
$stmt = $pdo->query((string)file_get_contents($sqlFile));
if ($stmt !== false) {
    do { /* drain */ } while ($stmt->nextRowset());
}
fwrite(STDOUT, "[tasks] tables ensured: sales_tasks, sales_task_activity, sales_comment_mentions\n");

// ── 2. Columns on existing tables ───────────────────────────────────────────
$columnExists = static function (PDO $pdo, string $table, string $column): bool {
    $q = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $q->execute([$table, $column]);
    return (int)$q->fetchColumn() > 0;
};

$tableExists = static function (PDO $pdo, string $table): bool {
    $q = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?'
    );
    $q->execute([$table]);
    return (int)$q->fetchColumn() > 0;
};

$additions = [
    // The follow-up edit trail. edit_reason is the part the team reads: a
    // rescheduled follow-up must never be indistinguishable from a missed one.
    ['sales_followups', 'edited_at',      "DATETIME DEFAULT NULL"],
    ['sales_followups', 'edited_by',      "INT UNSIGNED DEFAULT NULL"],
    ['sales_followups', 'edited_by_name', "VARCHAR(200) NOT NULL DEFAULT ''"],
    ['sales_followups', 'edit_reason',    "VARCHAR(300) DEFAULT NULL"],
    ['sales_followups', 'edit_count',     "INT UNSIGNED NOT NULL DEFAULT 0"],

    // Comments can now hang off a task, and carry mentions.
    ['sales_comments',  'task_id',        "INT UNSIGNED DEFAULT NULL"],
    ['sales_comments',  'mention_count',  "INT UNSIGNED NOT NULL DEFAULT 0"],

    // Did the conversion CREATE this customer, or link to one that already
    // existed? Undoing a conversion removes the customer it created, so this is
    // the one fact the undo cannot afford to guess. Rows converted before this
    // column existed read 0 and keep their customer.
    ['sales_leads',     'converted_client_created', "TINYINT(1) NOT NULL DEFAULT 0"],

    // The day the client actually came in, which is often not the day someone
    // got around to typing them in. NULL means the two are the same.
    ['sales_leads',     'acquired_on',   "DATE DEFAULT NULL"],
];

foreach ($additions as [$table, $column, $definition]) {
    if (!$tableExists($pdo, $table)) {
        fwrite(STDOUT, "[tasks] skipped $table.$column (table missing)\n");
        continue;
    }
    if ($columnExists($pdo, $table, $column)) {
        fwrite(STDOUT, "[tasks] ok      $table.$column\n");
        continue;
    }
    $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
    fwrite(STDOUT, "[tasks] added   $table.$column\n");
}

// One index for the task comment threads; ignored when it already exists.
if ($tableExists($pdo, 'sales_comments')) {
    $q = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?'
    );
    $q->execute(['sales_comments', 'idx_sc_task']);
    if ((int)$q->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE `sales_comments` ADD INDEX `idx_sc_task` (`tenant_id`, `task_id`, `id`)');
        fwrite(STDOUT, "[tasks] added   index sales_comments.idx_sc_task\n");
    } else {
        fwrite(STDOUT, "[tasks] ok      index sales_comments.idx_sc_task\n");
    }
}

fwrite(STDOUT, "[tasks] complete.\n");
