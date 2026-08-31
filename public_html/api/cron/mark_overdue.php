<?php
declare(strict_types=1);

date_default_timezone_set('Asia/Kolkata');

/**
 * Mark Overdue Payments — runs daily (e.g. 00:10).
 *
 * Sets payment_status = 'overdue' on ops_projects where:
 *   - balance > 0 (money still owed)
 *   - collection_target_date is set and < TODAY
 *   - payment_status is NOT already 'paid'
 *
 * Also clears 'overdue' back to 'partial' if collection_target_date was
 * extended to a future date (payment plan was revised without a payment).
 *
 * Logs to: api/cron/cron.log
 */

define('ROOT_PATH', dirname(__DIR__));

$LOG_FILE = __DIR__ . '/cron.log';

function cron_overdue_log(string $msg, string $logFile): void
{
    @file_put_contents(
        $logFile,
        '[' . date('Y-m-d H:i:s') . '] [mark_overdue] ' . $msg . PHP_EOL,
        FILE_APPEND
    );
}

cron_overdue_log('--- start (' . PHP_SAPI . ', php ' . PHP_VERSION . ') ---', $LOG_FILE);

try {
    require_once ROOT_PATH . '/config/app.php';
    require_once ROOT_PATH . '/config/database.php';
    require_once ROOT_PATH . '/core/AppException.php';
    require_once ROOT_PATH . '/core/Database.php';
} catch (Throwable $e) {
    cron_overdue_log('BOOTSTRAP FAILED: ' . $e->getMessage(), $LOG_FILE);
    exit(1);
}

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    header('Content-Type: application/json; charset=UTF-8');

    $expectedKey = '';
    $envPath = dirname(__DIR__, 2) . '/.env';
    if (file_exists($envPath)) {
        foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
            [$k, $v] = array_map('trim', explode('=', $line, 2));
            if ($k === 'CRON_KEY') { $expectedKey = $v; break; }
        }
    }

    $providedKey = $_GET['key'] ?? $_SERVER['HTTP_X_CRON_KEY'] ?? '';
    if ($expectedKey === '' || !hash_equals($expectedKey, (string)$providedKey)) {
        cron_overdue_log('HTTP forbidden — key mismatch', $LOG_FILE);
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }
}

try {
    $today = date('Y-m-d');

    // 1. Mark as overdue: balance > 0, target date passed, not yet paid
    $overdueResult = Database::query(
        "UPDATE ops_projects
         SET payment_status = 'overdue'
         WHERE balance > 0
           AND collection_target_date IS NOT NULL
           AND collection_target_date < ?
           AND payment_status NOT IN ('paid', 'overdue')",
        [$today]
    );

    // 2. Un-overdue: target date was extended into the future (plan revised)
    //    Revert to 'partial' if received > 0, or 'pending' if received = 0
    $unOverdueResult = Database::query(
        "UPDATE ops_projects
         SET payment_status = CASE WHEN received > 0 THEN 'partial' ELSE 'pending' END
         WHERE payment_status = 'overdue'
           AND (collection_target_date IS NULL OR collection_target_date >= ?)",
        [$today]
    );

    $markedOverdue   = $overdueResult->rowCount();
    $unmarkedOverdue = $unOverdueResult->rowCount();

    cron_overdue_log("marked overdue: {$markedOverdue}, un-overdue'd: {$unmarkedOverdue}", $LOG_FILE);

    $payload = [
        'success'          => true,
        'marked_overdue'   => $markedOverdue,
        'unmarked_overdue' => $unmarkedOverdue,
        'ranAt'            => date('c'),
    ];

    if ($isCli) {
        echo "[cron] mark_overdue: " . json_encode($payload) . PHP_EOL;
    } else {
        echo json_encode($payload);
    }
} catch (Throwable $e) {
    cron_overdue_log('RUN FAILED: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine(), $LOG_FILE);
    error_log('[cron mark_overdue] ' . $e->getMessage());
    if ($isCli) {
        fwrite(STDERR, "[cron] error: " . $e->getMessage() . PHP_EOL);
        exit(1);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
