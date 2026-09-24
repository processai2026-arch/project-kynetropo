<?php
declare(strict_types=1);

class AdminNotificationController
{
    public function index(Request $request): void
    {
        $tid   = Database::tenantId();
        $limit = min(20, max(1, (int)$request->query('limit', 10)));

        $rows = Database::fetchAll(
            'SELECT notification_id AS id, type, title, message, is_read, created_at
             FROM invoice_notifications
             WHERE tenant_id = ? AND is_read = 0
             ORDER BY created_at DESC LIMIT ?',
            [$tid, $limit]
        );
        foreach ($rows as &$r) {
            $r['is_read'] = (bool)$r['is_read'];
        }
        Response::success($rows);
    }
}
