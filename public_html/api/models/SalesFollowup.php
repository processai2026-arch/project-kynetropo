<?php
declare(strict_types=1);

/**
 * SalesFollowup — the action queue that drives the sales dashboard
 * ("Who do I need to follow up with?"). Buckets are computed against the
 * server date, never the device clock.
 */
class SalesFollowup
{
    public const STATUSES = ['pending', 'completed', 'cancelled'];
    public const BUCKETS  = ['today', 'overdue', 'upcoming', 'completed'];

    /**
     * How it went. Four answers, because those are the four things that
     * actually happen when you chase somebody: they want it, they don't, they
     * didn't answer, or the job is simply done.
     *
     * Deliberately shorter than the call outcomes: a call is a conversation
     * with many possible shapes, a follow-up is a question with an answer.
     */
    public const OUTCOMES = ['interested', 'not_interested', 'not_picked_up', 'completed'];

    /**
     * The same fact in the vocabulary the lead's "last outcome" already speaks,
     * so a follow-up and a call read alike on the lead. 'completed' says
     * nothing new about where the lead stands, so it leaves it alone.
     */
    public const OUTCOME_ON_LEAD = [
        'interested'     => 'interested',
        'not_interested' => 'not_interested',
        'not_picked_up'  => 'no_response',
    ];

    public static function create(array $data, ?int $createdBy): int
    {
        return Database::insert('sales_followups', [
            'tenant_id'   => Database::tenantId(),
            'lead_id'     => (int)$data['lead_id'],
            'call_id'     => !empty($data['call_id'])    ? (int)$data['call_id']    : null,
            'meeting_id'  => !empty($data['meeting_id']) ? (int)$data['meeting_id'] : null,
            'due_date'    => $data['due_date'],
            'due_time'    => $data['due_time'] ?? null,
            'assigned_to' => !empty($data['assigned_to']) ? (int)$data['assigned_to'] : null,
            'purpose'     => mb_substr((string)($data['purpose'] ?? ''), 0, 200),
            'status'      => 'pending',
            'created_by'  => $createdBy,
        ]);
    }

    public static function findRaw(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM sales_followups WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function complete(int $id, ?int $userId, ?string $notes, string $outcome = 'completed'): void
    {
        Database::execute(
            "UPDATE sales_followups
                SET status = 'completed', completed_by = ?, completed_at = NOW(),
                    outcome = ?, outcome_notes = ?
              WHERE id = ? AND tenant_id = ? AND status = 'pending'",
            [$userId, $outcome, $notes, $id, Database::tenantId()]
        );
    }

    /**
     * Applies an edit, and stamps who made it and why.
     *
     * The reason is not optional decoration: a follow-up that moves without one
     * is indistinguishable from one that was simply missed, and the queue exists
     * to make that difference visible to the whole team.
     */
    public static function edit(int $id, array $data, ?array $editor, string $reason): void
    {
        self::update($id, $data + [
            'edited_at'      => date('Y-m-d H:i:s'),
            'edited_by'      => isset($editor['user_id']) ? (int)$editor['user_id'] : null,
            'edited_by_name' => mb_substr((string)($editor['name'] ?? ''), 0, 200),
            'edit_reason'    => mb_substr($reason, 0, 300),
        ]);
        Database::execute(
            'UPDATE sales_followups SET edit_count = edit_count + 1 WHERE id = ? AND tenant_id = ?',
            [$id, Database::tenantId()]
        );
    }

    /**
     * Who this follow-up belongs to — the person it is assigned to, falling back
     * to whoever created it when it was never assigned. Only they may edit it.
     */
    public static function ownerId(array $row): int
    {
        $assigned = (int)($row['assigned_to'] ?? 0);
        return $assigned > 0 ? $assigned : (int)($row['created_by'] ?? 0);
    }

    public static function update(int $id, array $data): void
    {
        $fields = [];
        $params = [];
        foreach (['due_date', 'due_time', 'purpose', 'assigned_to', 'outcome_notes',
                  'edited_at', 'edited_by', 'edited_by_name', 'edit_reason'] as $col) {
            if (!array_key_exists($col, $data)) {
                continue;
            }
            $value = $col === 'assigned_to' ? (!empty($data[$col]) ? (int)$data[$col] : null) : $data[$col];
            $fields[] = "`$col` = ?";
            $params[] = $value;
        }
        if (!$fields) {
            return;
        }
        $params[] = $id;
        $params[] = Database::tenantId();
        Database::execute(
            'UPDATE sales_followups SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?',
            $params
        );
    }

    public static function cancel(int $id): void
    {
        Database::execute(
            "UPDATE sales_followups SET status = 'cancelled' WHERE id = ? AND tenant_id = ? AND status = 'pending'",
            [$id, Database::tenantId()]
        );
    }

    public static function forLead(int $leadId): array
    {
        $rows = Database::fetchAll(
            'SELECT f.*, u.name AS assigned_to_name
               FROM sales_followups f
               LEFT JOIN users u ON u.user_id = f.assigned_to
              WHERE f.tenant_id = ? AND f.lead_id = ?
              ORDER BY f.due_date DESC, (f.due_time IS NULL), f.due_time DESC, f.id DESC',
            [Database::tenantId(), $leadId]
        );
        return array_map([self::class, 'format'], $rows);
    }

    /**
     * Bucketed list for the Follow-Ups tab / dashboard.
     * @param string $bucket one of self::BUCKETS, or '' for all
     */
    public static function all(string $bucket, array $filters, array $scope, int $page = 1, int $limit = 100): array
    {
        $page  = max(1, $page);
        $limit = min(300, max(1, $limit));
        $today = date('Y-m-d');

        $where  = ['f.tenant_id = ?'];
        $params = [Database::tenantId()];

        if ($scope['sql'] !== '') {
            // A user may act on a follow-up assigned to them even when the lead is not.
            $where[]  = '(l.assigned_to = ? OR f.assigned_to = ?)';
            $params[] = $scope['params'][0];
            $params[] = $scope['params'][0];
        }

        switch ($bucket) {
            case 'today':
                $where[]  = "f.status = 'pending' AND f.due_date = ?";
                $params[] = $today;
                break;
            case 'overdue':
                $where[]  = "f.status = 'pending' AND f.due_date < ?";
                $params[] = $today;
                break;
            case 'upcoming':
                $where[]  = "f.status = 'pending' AND f.due_date > ?";
                $params[] = $today;
                break;
            case 'completed':
                $where[] = "f.status = 'completed'";
                break;
        }

        if (!empty($filters['lead_id'])) {
            $where[]  = 'f.lead_id = ?';
            $params[] = (int)$filters['lead_id'];
        }
        if (!empty($filters['assigned_to'])) {
            $where[]  = 'f.assigned_to = ?';
            $params[] = (int)$filters['assigned_to'];
        }

        $whereClause = implode(' AND ', $where);

        $total = Database::count(
            "SELECT COUNT(*) AS cnt FROM sales_followups f
               JOIN sales_leads l ON l.id = f.lead_id AND l.tenant_id = f.tenant_id
              WHERE $whereClause",
            $params
        );

        $order = $bucket === 'completed'
            ? 'f.completed_at DESC, f.id DESC'
            : 'f.due_date ASC, (f.due_time IS NULL), f.due_time ASC, f.id ASC';

        $rows = Database::fetchAll(
            "SELECT f.*, u.name AS assigned_to_name,
                    (SELECT COUNT(*) FROM sales_comments sc
                      WHERE sc.tenant_id = f.tenant_id AND sc.entity_type = 'followup'
                        AND sc.entity_id = f.id AND sc.deleted_at IS NULL) AS comment_count,
                    l.name AS lead_name, l.company AS lead_company, l.phone AS lead_phone,
                    l.contact_person AS lead_contact_person, l.temperature AS lead_temperature,
                    l.last_outcome AS lead_last_outcome
               FROM sales_followups f
               JOIN sales_leads l ON l.id = f.lead_id AND l.tenant_id = f.tenant_id
               LEFT JOIN users u ON u.user_id = f.assigned_to
              WHERE $whereClause
              ORDER BY $order
              LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );

        return [
            'rows'       => array_map([self::class, 'format'], $rows),
            'pagination' => [
                'page'        => $page,
                'limit'       => $limit,
                'total'       => $total,
                'total_pages' => (int)ceil($total / max(1, $limit)),
            ],
        ];
    }

    /** Counts for the dashboard summary + tab badges. */
    public static function counts(array $scope): array
    {
        $today  = date('Y-m-d');
        $params = [Database::tenantId()];
        $extra  = '';

        if ($scope['sql'] !== '') {
            $extra    = ' AND (l.assigned_to = ? OR f.assigned_to = ?)';
            $params[] = $scope['params'][0];
            $params[] = $scope['params'][0];
        }

        $row = Database::fetch(
            "SELECT
               SUM(f.status = 'pending' AND f.due_date = ?)  AS today_count,
               SUM(f.status = 'pending' AND f.due_date < ?)  AS overdue_count,
               SUM(f.status = 'pending' AND f.due_date > ?)  AS upcoming_count,
               SUM(f.status = 'completed')                   AS completed_count
             FROM sales_followups f
             JOIN sales_leads l ON l.id = f.lead_id AND l.tenant_id = f.tenant_id
             WHERE f.tenant_id = ?" . $extra,
            [$today, $today, $today, ...$params]
        );

        return [
            'today'     => (int)($row['today_count']     ?? 0),
            'overdue'   => (int)($row['overdue_count']   ?? 0),
            'upcoming'  => (int)($row['upcoming_count']  ?? 0),
            'completed' => (int)($row['completed_count'] ?? 0),
        ];
    }

    public static function format(array $row): array
    {
        return [
            'id'                  => (int)$row['id'],
            'lead_id'             => (int)$row['lead_id'],
            'lead_name'           => $row['lead_name']           ?? null,
            'lead_company'        => $row['lead_company']        ?? null,
            'lead_phone'          => $row['lead_phone']          ?? null,
            'lead_contact_person' => $row['lead_contact_person'] ?? null,
            'lead_temperature'    => $row['lead_temperature']    ?? null,
            'lead_last_outcome'   => $row['lead_last_outcome']   ?? null,
            'call_id'             => $row['call_id']    !== null ? (int)$row['call_id']    : null,
            'meeting_id'          => $row['meeting_id'] !== null ? (int)$row['meeting_id'] : null,
            'due_date'            => $row['due_date'],
            'due_time'            => $row['due_time'],
            'assigned_to'         => $row['assigned_to'] !== null ? (int)$row['assigned_to'] : null,
            'assigned_to_name'    => $row['assigned_to_name'] ?? null,
            'status'              => $row['status'],
            'purpose'             => $row['purpose'],
            // '' for anything completed before outcomes existed, and for
            // anything still pending. The client shows a badge only when there
            // is one, rather than inventing an answer nobody gave.
            'outcome'             => (string)($row['outcome'] ?? ''),
            'outcome_notes'       => $row['outcome_notes'],
            'completed_by'        => $row['completed_by'] !== null ? (int)$row['completed_by'] : null,
            'completed_at'        => $row['completed_at'],
            'comment_count'       => isset($row['comment_count']) ? (int)$row['comment_count'] : 0,
            'created_by'          => isset($row['created_by']) && $row['created_by'] !== null
                                     ? (int)$row['created_by'] : null,
            // The edit trail travels with the row: everyone who can see the
            // follow-up sees that it moved, who moved it, and why.
            'edited_at'           => $row['edited_at']      ?? null,
            'edited_by'           => isset($row['edited_by']) && $row['edited_by'] !== null
                                     ? (int)$row['edited_by'] : null,
            'edited_by_name'      => ($row['edited_by_name'] ?? '') !== '' ? $row['edited_by_name'] : null,
            'edit_reason'         => $row['edit_reason']    ?? null,
            'edit_count'          => isset($row['edit_count']) ? (int)$row['edit_count'] : 0,
            'owner_id'            => self::ownerId($row),
            'created_at'          => $row['created_at'],
        ];
    }
}
