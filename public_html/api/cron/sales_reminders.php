<?php
declare(strict_types=1);
date_default_timezone_set('Asia/Kolkata');

/**
 * Sales Reminders — run every 2 hours (8am-8pm) to notify users of overdue/due-today items.
 */

define('ROOT_PATH', dirname(__DIR__));
$LOG_FILE = __DIR__ . '/cron.log';

function cron_log(string $msg, string $logFile): void {
    @file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . '] [sales_reminders] ' . $msg . PHP_EOL, FILE_APPEND);
}

cron_log('--- start ---', $LOG_FILE);

try {
    require_once ROOT_PATH . '/config/app.php';
    require_once ROOT_PATH . '/config/database.php';
    require_once ROOT_PATH . '/core/AppException.php';
    require_once ROOT_PATH . '/core/Database.php';
    require_once ROOT_PATH . '/helpers/WebPush.php';
    require_once ROOT_PATH . '/models/PushSubscription.php';
} catch (Throwable $e) { cron_log('BOOTSTRAP FAILED: ' . $e->getMessage(), $LOG_FILE); exit(1); }

$isCli = (PHP_SAPI === 'cli');
if (!$isCli) {
    header('Content-Type: application/json');
    $envPath = dirname(__DIR__, 2) . '/.env';
    $expectedKey = '';
    if (file_exists($envPath)) {
        foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
            [$k, $v] = array_map('trim', explode('=', $line, 2));
            if ($k === 'CRON_KEY') { $expectedKey = $v; break; }
        }
    }
    if ($expectedKey === '' || !hash_equals($expectedKey, $_GET['key'] ?? '')) {
        http_response_code(403); echo json_encode(['success' => false]); exit;
    }
}

if (!WebPush::configured()) { echo json_encode(['success' => true, 'sent' => 0]); exit; }

try {
    $today = date('Y-m-d');
    $sentCount = 0;
    $userNotifs = [];

    // Overdue follow-ups
    foreach (Database::fetchAll("SELECT f.id, f.assigned_to, f.due_date, l.name FROM sales_followups f LEFT JOIN sales_leads l ON l.id = f.lead_id AND l.tenant_id = f.tenant_id WHERE f.status = 'pending' AND f.due_date < ? AND f.assigned_to IS NOT NULL", [$today]) as $r) {
        $d = (int)((strtotime($today) - strtotime($r['due_date'])) / 86400);
        $userNotifs[(int)$r['assigned_to']][] = ['title' => '⚠️ Overdue Follow-up', 'body' => ($r['name'] ?: 'Lead') . " - {$d}d overdue", 'url' => '/sales/followups', 'tag' => "fu-o-{$r['id']}"];
    }

    // Today follow-ups
    foreach (Database::fetchAll("SELECT f.id, f.assigned_to, f.due_time, l.name FROM sales_followups f LEFT JOIN sales_leads l ON l.id = f.lead_id AND l.tenant_id = f.tenant_id WHERE f.status = 'pending' AND f.due_date = ? AND f.assigned_to IS NOT NULL", [$today]) as $r) {
        $t = $r['due_time'] ? ' at ' . date('g:i A', strtotime($r['due_time'])) : '';
        $userNotifs[(int)$r['assigned_to']][] = ['title' => '📞 Follow-up Today', 'body' => ($r['name'] ?: 'Lead') . $t, 'url' => '/sales/followups', 'tag' => "fu-t-{$r['id']}"];
    }

    // Overdue tasks
    foreach (Database::fetchAll("SELECT id, title, assigned_to, due_date, priority FROM sales_tasks WHERE status = 'open' AND due_date < ? AND assigned_to IS NOT NULL", [$today]) as $r) {
        $d = (int)((strtotime($today) - strtotime($r['due_date'])) / 86400);
        $p = $r['priority'] === 'urgent' ? '🚨 ' : ($r['priority'] === 'high' ? '🔴 ' : '');
        $userNotifs[(int)$r['assigned_to']][] = ['title' => "{$p}⚠️ Overdue Task", 'body' => "{$r['title']} - {$d}d overdue", 'url' => '/sales/tasks', 'tag' => "tk-o-{$r['id']}"];
    }

    // Today tasks
    foreach (Database::fetchAll("SELECT id, title, assigned_to, due_time, priority FROM sales_tasks WHERE status = 'open' AND due_date = ? AND assigned_to IS NOT NULL", [$today]) as $r) {
        $t = $r['due_time'] ? ' at ' . date('g:i A', strtotime($r['due_time'])) : '';
        $p = $r['priority'] === 'urgent' ? '🚨 ' : ($r['priority'] === 'high' ? '🔴 ' : '');
        $userNotifs[(int)$r['assigned_to']][] = ['title' => "{$p}✅ Task Today", 'body' => "{$r['title']}{$t}", 'url' => '/sales/tasks', 'tag' => "tk-t-{$r['id']}"];
    }

    // Overdue meetings
    foreach (Database::fetchAll("SELECT m.id, m.title, m.meeting_date, m.created_by, l.name, l.assigned_to FROM sales_meetings m LEFT JOIN sales_leads l ON l.id = m.lead_id AND l.tenant_id = m.tenant_id WHERE m.status = 'scheduled' AND m.meeting_date < ?", [$today]) as $r) {
        $d = (int)((strtotime($today) - strtotime($r['meeting_date'])) / 86400);
        foreach (array_unique(array_filter([(int)$r['created_by'], (int)($r['assigned_to'] ?? 0)])) as $uid)
            $userNotifs[$uid][] = ['title' => '⚠️ Missed Meeting', 'body' => ($r['title'] ?: $r['name'] ?: 'Meeting') . " - {$d}d ago", 'url' => '/sales/meetings', 'tag' => "mt-o-{$r['id']}"];
    }

    // Today meetings
    foreach (Database::fetchAll("SELECT m.id, m.title, m.meeting_time, m.created_by, l.name, l.assigned_to FROM sales_meetings m LEFT JOIN sales_leads l ON l.id = m.lead_id AND l.tenant_id = m.tenant_id WHERE m.status = 'scheduled' AND m.meeting_date = ?", [$today]) as $r) {
        $t = $r['meeting_time'] ? ' at ' . date('g:i A', strtotime($r['meeting_time'])) : '';
        foreach (array_unique(array_filter([(int)$r['created_by'], (int)($r['assigned_to'] ?? 0)])) as $uid)
            $userNotifs[$uid][] = ['title' => '📅 Meeting Today', 'body' => ($r['title'] ?: $r['name'] ?: 'Meeting') . $t, 'url' => '/sales/meetings', 'tag' => "mt-t-{$r['id']}"];
    }

    // Send
    foreach ($userNotifs as $uid => $notifs) {
        $subs = PushSubscription::forUsers([$uid]);
        if (!$subs) continue;
        if (count($notifs) > 5) {
            $o = count(array_filter($notifs, fn($n) => str_contains($n['tag'], '-o-')));
            $notifs = [['title' => '📋 Sales Reminders', 'body' => ($o ? "{$o} overdue, " : '') . (count($notifs) - $o) . ' due today', 'url' => '/sales', 'tag' => "sum-{$uid}"]];
        }
        foreach ($notifs as $n) foreach ($subs as $sub) {
            $res = WebPush::send($sub, $n);
            $res['ok'] ? PushSubscription::noteSuccess((int)$sub['id']) : PushSubscription::noteFailure((int)$sub['id'], (bool)$res['gone']);
            if ($res['ok']) $sentCount++;
        }
    }

    cron_log("sent {$sentCount} to " . count($userNotifs) . " users", $LOG_FILE);
    echo json_encode(['success' => true, 'sent' => $sentCount, 'users' => count($userNotifs), 'ranAt' => date('c')]);

} catch (Throwable $e) {
    cron_log('FAILED: ' . $e->getMessage(), $LOG_FILE);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

