<?php
declare(strict_types=1);

class AdminNotificationController
{
    public function index(Request $request): void
    {
        $tid   = Database::tenantId();
        $limit = min(20, max(1, (int)$request->query('limit', 10)));

        // AMC renewals due within 30 days or overdue come first: they are
        // money to collect. Worked out live, so they clear once collected.
        $amc = [];
        try {
            foreach (OpsAmcAlerts::due($tid) as $a) {
                $days  = (int)$a['days_until_due'];
                $when  = $days < 0 ? abs($days) . ' day' . (abs($days) === 1 ? '' : 's') . ' overdue'
                       : ($days === 0 ? 'due today' : 'due in ' . $days . ' day' . ($days === 1 ? '' : 's'));
                $amc[] = [
                    'id'         => 'amc:' . $a['id'] . ':' . $a['due_date'],
                    'type'       => 'amc',
                    'title'      => $days < 0 ? 'AMC overdue' : 'AMC due',
                    'message'    => 'AMC ₹' . number_format((float)$a['amount']) . ' — ' . $a['client_name'] . ' · ' . $a['project_name'] . ', ' . $when,
                    'is_read'    => false,
                    'created_at' => $a['due_date'] . ' 00:00:00',
                    'url'        => '/amc',
                    'severity'   => $days < 0 ? 'urgent' : 'normal',
                ];
            }
        } catch (\Throwable $e) {
            error_log('[Notifications] AMC alerts: ' . $e->getMessage());
        }

        try {
            $rows = Database::fetchAll(
                'SELECT notification_id AS id, type, title, message, is_read, created_at
                 FROM invoice_notifications
                 WHERE tenant_id = ? AND is_read = 0
                 ORDER BY created_at DESC LIMIT ?',
                [$tid, $limit]
            );
        } catch (\Throwable $e) {
            // Table not yet created — return empty list rather than 500.
            $rows = [];
        }
        foreach ($rows as &$r) {
            $r['is_read'] = (bool)$r['is_read'];
        }
        unset($r);
        Response::success(array_merge($amc, $rows));
    }
}
