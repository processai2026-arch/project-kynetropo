<?php
declare(strict_types=1);

/**
 * Admin Invoice Notification Controller
 * PUT    /admin/invoice-notifications/read-all  — mark all read
 * GET    /admin/invoice-notifications            — list
 * PUT    /admin/invoice-notifications/{id}/read  — mark one read
 * DELETE /admin/invoice-notifications/{id}       — delete
 */
class AdminInvoiceNotificationController
{
    public function index(Request $request): void
    {
        $tid    = Database::tenantId();
        $page   = max(1, (int)$request->query('page', 1));
        $limit  = min(100, max(1, (int)$request->query('limit', 20)));
        $where  = ['tenant_id = ?'];
        $params = [$tid];

        $isRead = $request->query('is_read');
        if ($isRead !== null) {
            $where[] = 'is_read = ?'; $params[] = $isRead === '1' || $isRead === 'true' ? 1 : 0;
        }

        $wc    = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM invoice_notifications WHERE $wc", $params);
        $rows  = Database::fetchAll(
            "SELECT * FROM invoice_notifications WHERE $wc ORDER BY created_at DESC LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );
        foreach ($rows as &$r) { $r['is_read'] = (bool)$r['is_read']; }
        $unread = Database::count('SELECT COUNT(*) AS cnt FROM invoice_notifications WHERE tenant_id = ? AND is_read = 0', [$tid]);
        Response::paginated($rows, [
            'page' => $page, 'limit' => $limit, 'total' => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
            'unread_count' => $unread,
        ]);
    }

    public function markRead(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        if ($id <= 0 || !Database::fetch('SELECT notification_id FROM invoice_notifications WHERE notification_id = ? AND tenant_id = ?', [$id, $tid])) {
            Response::error('Notification not found', 404);
        }
        Database::execute(
            'UPDATE invoice_notifications SET is_read = 1, read_at = NOW() WHERE notification_id = ? AND tenant_id = ?',
            [$id, $tid]
        );
        Response::success(null, 'Marked as read');
    }

    public function readAll(Request $request): void
    {
        $tid = Database::tenantId();
        Database::execute(
            'UPDATE invoice_notifications SET is_read = 1, read_at = NOW() WHERE tenant_id = ? AND is_read = 0',
            [$tid]
        );
        Response::success(null, 'All notifications marked as read');
    }

    public function destroy(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        if ($id <= 0 || !Database::fetch('SELECT notification_id FROM invoice_notifications WHERE notification_id = ? AND tenant_id = ?', [$id, $tid])) {
            Response::error('Notification not found', 404);
        }
        Database::execute('DELETE FROM invoice_notifications WHERE notification_id = ? AND tenant_id = ?', [$id, $tid]);
        Response::success(null, 'Notification deleted');
    }
}
