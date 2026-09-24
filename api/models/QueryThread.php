<?php
declare(strict_types=1);

class QueryThread
{
    public const STATUSES = ['pending', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
    public const TRANSITIONS = [
        'pending' => ['in_progress', 'resolved', 'closed'],
        'in_progress' => ['pending', 'waiting_customer', 'resolved', 'closed'],
        'waiting_customer' => ['in_progress', 'resolved', 'closed'],
        'resolved' => ['in_progress', 'closed'],
        'closed' => ['in_progress'],
    ];

    public static function canTransition(string $from, string $to): bool
    {
        return $from === $to || in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    public static function find(int $queryId): ?array
    {
        $row = Database::fetch(
            'SELECT q.*, u.name AS assigned_to_name
             FROM queries q
             LEFT JOIN users u ON u.user_id = q.assigned_to AND u.tenant_id = q.tenant_id
             WHERE q.query_id = ? AND q.tenant_id = ? LIMIT 1',
            [$queryId, Database::tenantId()]
        );
        if (!$row) {
            return null;
        }
        $row['messages'] = self::messages($queryId);
        return $row;
    }

    public static function messages(int $queryId): array
    {
        $rows = Database::fetchAll(
            'SELECT qm.message_id, qm.sender_type, qm.sender_user_id, qm.message,
                    qm.delivery_channel, qm.delivery_status, qm.delivery_error,
                    qm.delivered_at, qm.created_at, u.name AS sender_name
             FROM query_messages qm
             LEFT JOIN users u ON u.user_id = qm.sender_user_id AND u.tenant_id = qm.tenant_id
             WHERE qm.query_id = ? AND qm.tenant_id = ?
             ORDER BY qm.created_at ASC, qm.message_id ASC',
            [$queryId, Database::tenantId()]
        );
        if ($rows === []) {
            $query = Database::fetch(
                'SELECT user_id, message, created_at FROM queries WHERE query_id = ? AND tenant_id = ?',
                [$queryId, Database::tenantId()]
            );
            if ($query) {
                self::addMessage($queryId, 'customer', $query['message'], isset($query['user_id']) ? (int)$query['user_id'] : null);
                return self::messages($queryId);
            }
        }
        return $rows;
    }

    public static function addMessage(
        int $queryId,
        string $senderType,
        string $message,
        ?int $senderUserId = null,
        string $deliveryStatus = 'not_requested',
        ?string $deliveryError = null
    ): int {
        return Database::insertTenant('query_messages', [
            'query_id' => $queryId,
            'sender_type' => $senderType,
            'sender_user_id' => $senderUserId,
            'message' => $message,
            'delivery_channel' => $senderType === 'staff' ? 'email' : null,
            'delivery_status' => $deliveryStatus,
            'delivery_error' => $deliveryError,
            'delivered_at' => $deliveryStatus === 'sent' ? date('Y-m-d H:i:s') : null,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public static function updateMessageDelivery(int $messageId, bool $sent, ?string $error = null): void
    {
        Database::execute(
            'UPDATE query_messages SET delivery_status = ?, delivery_error = ?, delivered_at = ?
             WHERE message_id = ? AND tenant_id = ?',
            [$sent ? 'sent' : 'failed', $error, $sent ? date('Y-m-d H:i:s') : null, $messageId, Database::tenantId()]
        );
    }

    public static function update(int $queryId, array $data): void
    {
        Database::execute(
            'UPDATE queries
             SET assigned_to = ?, priority = ?, sla_due_at = ?, status = ?,
                 resolved_at = CASE WHEN ? = "resolved" AND status <> "resolved" THEN NOW() ELSE resolved_at END,
                 closed_at = CASE WHEN ? = "closed" AND status <> "closed" THEN NOW() ELSE closed_at END,
                 updated_at = NOW()
             WHERE query_id = ? AND tenant_id = ?',
            [
                $data['assigned_to'], $data['priority'], $data['sla_due_at'], $data['status'],
                $data['status'], $data['status'], $queryId, Database::tenantId(),
            ]
        );
    }

    public static function staff(): array
    {
        return Database::fetchAll(
            'SELECT user_id, name, email, staff_role FROM users
             WHERE tenant_id = ? AND user_type = "admin" AND is_active = 1 ORDER BY name',
            [Database::tenantId()]
        );
    }
}
