<?php
declare(strict_types=1);

require_once __DIR__ . '/../../models/QueryThread.php';

class AdminQueryController
{
    private const UI_TO_DB = [
        'New' => 'pending',
        'In Progress' => 'in_progress',
        'Waiting on Customer' => 'waiting_customer',
        'Resolved' => 'resolved',
        'Closed' => 'closed',
    ];

    private static function normalizeRow(array $row): array
    {
        $row['status'] = array_search($row['status'] ?? 'pending', self::UI_TO_DB, true) ?: 'New';
        $row['admin_reply'] = $row['admin_reply'] ?? '';
        $row['priority'] = $row['priority'] ?? 'normal';
        $row['sla_breached'] = !empty($row['sla_due_at'])
            && strtotime((string)$row['sla_due_at']) < time()
            && !in_array($row['status'], ['Resolved', 'Closed'], true);
        return $row;
    }

    public function index(Request $request): void
    {
        $page = max(1, (int)$request->query('page', 1));
        $limit = min(500, max(1, (int)$request->query('limit', 500)));
        $where = ['q.tenant_id = ?'];
        $params = [Database::tenantId()];

        $uiStatus = (string)$request->query('status', '');
        if (isset(self::UI_TO_DB[$uiStatus])) {
            $where[] = 'q.status = ?';
            $params[] = self::UI_TO_DB[$uiStatus];
        }
        $search = trim((string)$request->query('search', ''));
        if ($search !== '') {
            $like = '%' . $search . '%';
            $where[] = '(q.name LIKE ? OR q.email LIKE ? OR q.query_number LIKE ? OR q.message LIKE ?)';
            array_push($params, $like, $like, $like, $like);
        }

        $whereClause = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM queries q WHERE $whereClause", $params);
        $rows = Database::fetchAll(
            "SELECT q.query_id, q.user_id, q.query_number, q.name, q.email, q.message,
                    q.admin_reply, q.status, q.assigned_to, q.priority, q.sla_due_at,
                    q.resolved_at, q.closed_at, q.created_at, q.updated_at,
                    u.name AS assigned_to_name,
                    (SELECT COUNT(*) FROM query_messages qm WHERE qm.query_id=q.query_id AND qm.tenant_id=q.tenant_id) AS message_count
             FROM queries q
             LEFT JOIN users u ON u.user_id=q.assigned_to AND u.tenant_id=q.tenant_id
             WHERE $whereClause ORDER BY q.created_at DESC LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );
        Response::paginated(array_map([self::class, 'normalizeRow'], $rows), [
            'page' => $page, 'limit' => $limit, 'total' => $total,
            'total_pages' => (int)ceil($total / $limit),
        ]);
    }

    public function show(Request $request): void
    {
        $query = QueryThread::find((int)$request->param('id'));
        if (!$query) {
            Response::error('Query not found', 404);
        }
        Response::success(self::normalizeRow($query), 'Query details retrieved');
    }

    public function staff(Request $request): void
    {
        Response::success(QueryThread::staff());
    }

    public function reply(Request $request): void
    {
        $queryId = (int)$request->param('id');
        $query = QueryThread::find($queryId);
        if (!$query) {
            Response::error('Query not found', 404);
        }

        $uiStatus = (string)$request->input('status', $query['status'] ?? 'New');
        $priority = strtolower((string)$request->input('priority', $query['priority'] ?? 'normal'));
        $assignedTo = $request->input('assigned_to', $query['assigned_to'] ?? null);
        $assignedTo = $assignedTo !== null && $assignedTo !== '' ? (int)$assignedTo : null;
        $slaDueAt = trim((string)$request->input('sla_due_at', (string)($query['sla_due_at'] ?? '')));
        $message = trim((string)$request->input('message', $request->input('admin_reply', '')));

        if (!isset(self::UI_TO_DB[$uiStatus])) {
            Response::error('Invalid status lifecycle value', 422);
        }
        $currentStatus = (string)($query['status'] ?? 'pending');
        $nextStatus = self::UI_TO_DB[$uiStatus];
        if (!QueryThread::canTransition($currentStatus, $nextStatus)) {
            Response::error("Status cannot move from {$currentStatus} to {$nextStatus}", 409);
        }
        if (!in_array($priority, QueryThread::PRIORITIES, true)) {
            Response::error('Invalid priority', 422);
        }
        if ($slaDueAt !== '' && strtotime($slaDueAt) === false) {
            Response::error('Invalid SLA due time', 422);
        }
        if ($assignedTo !== null) {
            $staff = Database::fetch(
                'SELECT user_id FROM users WHERE user_id=? AND tenant_id=? AND user_type="admin" AND is_active=1',
                [$assignedTo, Database::tenantId()]
            );
            if (!$staff) {
                Response::error('Assigned staff user not found', 422);
            }
        }

        Database::beginTransaction();
        try {
            QueryThread::update($queryId, [
                'assigned_to' => $assignedTo,
                'priority' => $priority,
                'sla_due_at' => $slaDueAt !== '' ? date('Y-m-d H:i:s', strtotime($slaDueAt)) : null,
                'status' => $nextStatus,
            ]);
            $messageId = null;
            if ($message !== '') {
                $messageId = QueryThread::addMessage(
                    $queryId, 'staff', Request::sanitize($message),
                    isset($request->user['user_id']) ? (int)$request->user['user_id'] : null
                );
                Database::execute(
                    'UPDATE queries SET admin_reply=? WHERE query_id=? AND tenant_id=?',
                    [Request::sanitize($message), $queryId, Database::tenantId()]
                );
            }
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            error_log('Query update error: ' . $e->getMessage());
            Response::error('Could not update query', 500);
        }

        if ($messageId !== null) {
            [$sent, $error] = $this->sendReplyEmail($query, $message);
            QueryThread::updateMessageDelivery($messageId, $sent, $error);
        }
        Response::success(self::normalizeRow(QueryThread::find($queryId) ?? []), 'Query updated');
    }

    private function sendReplyEmail(array $query, string $message): array
    {
        if (empty($query['email'])) {
            return [false, 'Customer email is missing'];
        }
        $settings = Database::fetchAll(
            "SELECT setting_key, setting_value FROM settings WHERE tenant_id=? AND setting_key IN ('company_name','company_email')",
            [Database::tenantId()]
        );
        $map = [];
        foreach ($settings as $row) {
            $map[$row['setting_key']] = $row['setting_value'];
        }
        $company = $map['company_name'] ?? 'Our Team';
        $from = $map['company_email'] ?? 'noreply@kynetropo.com';
        $subject = 'Re: ' . ($query['query_number'] ?? 'Your support query');
        $html = '<div style="font-family:Arial,sans-serif;max-width:600px">'
            . '<h2>' . htmlspecialchars($company) . ' Support</h2><p>Dear ' . htmlspecialchars((string)$query['name']) . ',</p>'
            . '<div style="padding:14px;background:#ecfdf5;border-left:4px solid #10b981">'
            . nl2br(htmlspecialchars($message)) . '</div><p>Regards,<br>' . htmlspecialchars($company) . '</p></div>';
        $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: "
            . $company . " Support <{$from}>\r\n";
        try {
            $sent = mail((string)$query['email'], $subject, $html, $headers);
            return [$sent, $sent ? null : 'mail() returned false'];
        } catch (Throwable $e) {
            error_log('Query reply email error: ' . $e->getMessage());
            return [false, mb_substr($e->getMessage(), 0, 500)];
        }
    }
}
