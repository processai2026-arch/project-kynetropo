<?php
declare(strict_types=1);

/**
 * SalesMeeting — physical/virtual meetings scheduled from a lead (spec §16/§17).
 *
 * Separate from the existing `ops_meetings` (project delivery meetings): these
 * belong to the pre-sales lifecycle and hang off a sales lead, not a client.
 */
class SalesMeeting
{
    public const TYPES    = ['physical', 'virtual'];
    public const STATUSES = ['scheduled', 'completed', 'cancelled'];
    public const OUTCOMES = ['positive', 'neutral', 'negative', 'rescheduled', 'no_show', 'other'];

    public static function create(array $data, ?int $createdBy): int
    {
        return Database::insert('sales_meetings', [
            'tenant_id'    => Database::tenantId(),
            'lead_id'      => (int)$data['lead_id'],
            'title'        => $data['title'],
            'meeting_type' => $data['meeting_type'],
            'meeting_date' => $data['meeting_date'],
            'meeting_time' => $data['meeting_time'] ?? null,
            'place'        => (string)($data['place'] ?? ''),
            'meeting_link' => (string)($data['meeting_link'] ?? ''),
            'participants' => $data['participants'] ?? null,
            'notes'        => $data['notes'] ?? null,
            'assigned_to'  => !empty($data['assigned_to']) ? (int)$data['assigned_to'] : null,
            'status'       => 'scheduled',
            'created_by'   => $createdBy,
        ]);
    }

    public static function findRaw(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM sales_meetings WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function update(int $id, array $data): void
    {
        $columns = [
            'title', 'meeting_type', 'meeting_date', 'meeting_time',
            'place', 'meeting_link', 'participants', 'notes', 'assigned_to',
        ];
        $fields = [];
        $params = [];
        foreach ($columns as $col) {
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
            'UPDATE sales_meetings SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?',
            $params
        );
    }

    public static function complete(int $id, array $data): void
    {
        Database::execute(
            "UPDATE sales_meetings
                SET status = 'completed', outcome = ?, outcome_notes = ?, requirements = ?,
                    decisions = ?, next_action = ?, next_meeting_date = ?, completed_at = NOW()
              WHERE id = ? AND tenant_id = ? AND status = 'scheduled'",
            [
                $data['outcome'],
                $data['outcome_notes']     ?? null,
                $data['requirements']      ?? null,
                $data['decisions']         ?? null,
                $data['next_action']       ?? null,
                $data['next_meeting_date'] ?? null,
                $id,
                Database::tenantId(),
            ]
        );
    }

    public static function cancel(int $id): void
    {
        Database::execute(
            "UPDATE sales_meetings SET status = 'cancelled' WHERE id = ? AND tenant_id = ? AND status = 'scheduled'",
            [$id, Database::tenantId()]
        );
    }

    public static function forLead(int $leadId): array
    {
        $rows = Database::fetchAll(
            'SELECT m.*, u.name AS assigned_to_name
               FROM sales_meetings m
               LEFT JOIN users u ON u.user_id = m.assigned_to
              WHERE m.tenant_id = ? AND m.lead_id = ?
              ORDER BY m.meeting_date DESC, (m.meeting_time IS NULL), m.meeting_time DESC, m.id DESC',
            [Database::tenantId(), $leadId]
        );
        return array_map([self::class, 'format'], $rows);
    }

    public static function all(array $filters, array $scope, int $page = 1, int $limit = 100): array
    {
        $page  = max(1, $page);
        $limit = min(300, max(1, $limit));

        $where  = ['m.tenant_id = ?'];
        $params = [Database::tenantId()];

        if ($scope['sql'] !== '') {
            $where[]  = '(l.assigned_to = ? OR m.assigned_to = ?)';
            $params[] = $scope['params'][0];
            $params[] = $scope['params'][0];
        }
        if (!empty($filters['status']) && in_array($filters['status'], self::STATUSES, true)) {
            $where[]  = 'm.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['meeting_type']) && in_array($filters['meeting_type'], self::TYPES, true)) {
            $where[]  = 'm.meeting_type = ?';
            $params[] = $filters['meeting_type'];
        }
        if (!empty($filters['lead_id'])) {
            $where[]  = 'm.lead_id = ?';
            $params[] = (int)$filters['lead_id'];
        }
        if (!empty($filters['date_from'])) {
            $where[]  = 'm.meeting_date >= ?';
            $params[] = $filters['date_from'];
        }
        if (!empty($filters['date_to'])) {
            $where[]  = 'm.meeting_date <= ?';
            $params[] = $filters['date_to'];
        }

        $whereClause = implode(' AND ', $where);

        $total = Database::count(
            "SELECT COUNT(*) AS cnt FROM sales_meetings m
               JOIN sales_leads l ON l.id = m.lead_id AND l.tenant_id = m.tenant_id
              WHERE $whereClause",
            $params
        );

        $rows = Database::fetchAll(
            "SELECT m.*, u.name AS assigned_to_name,
                    (SELECT COUNT(*) FROM sales_comments sc
                      WHERE sc.tenant_id = m.tenant_id AND sc.entity_type = 'meeting'
                        AND sc.entity_id = m.id AND sc.deleted_at IS NULL) AS comment_count,
                    l.name AS lead_name, l.company AS lead_company, l.temperature AS lead_temperature
               FROM sales_meetings m
               JOIN sales_leads l ON l.id = m.lead_id AND l.tenant_id = m.tenant_id
               LEFT JOIN users u ON u.user_id = m.assigned_to
              WHERE $whereClause
              ORDER BY m.meeting_date ASC, (m.meeting_time IS NULL), m.meeting_time ASC, m.id ASC
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

    public static function counts(array $scope): array
    {
        $today  = date('Y-m-d');
        $params = [Database::tenantId()];
        $extra  = '';

        if ($scope['sql'] !== '') {
            $extra    = ' AND (l.assigned_to = ? OR m.assigned_to = ?)';
            $params[] = $scope['params'][0];
            $params[] = $scope['params'][0];
        }

        $row = Database::fetch(
            "SELECT
               SUM(m.status = 'scheduled' AND m.meeting_date = ?) AS today_count,
               SUM(m.status = 'scheduled' AND m.meeting_date > ?) AS upcoming_count
             FROM sales_meetings m
             JOIN sales_leads l ON l.id = m.lead_id AND l.tenant_id = m.tenant_id
             WHERE m.tenant_id = ?" . $extra,
            [$today, $today, ...$params]
        );

        return [
            'today'    => (int)($row['today_count']    ?? 0),
            'upcoming' => (int)($row['upcoming_count'] ?? 0),
        ];
    }

    public static function format(array $row): array
    {
        return [
            'id'                => (int)$row['id'],
            'lead_id'           => (int)$row['lead_id'],
            'lead_name'         => $row['lead_name']        ?? null,
            'lead_company'      => $row['lead_company']     ?? null,
            'lead_temperature'  => $row['lead_temperature'] ?? null,
            'title'             => $row['title'],
            'meeting_type'      => $row['meeting_type'],
            'meeting_date'      => $row['meeting_date'],
            'meeting_time'      => $row['meeting_time'],
            'place'             => $row['place'],
            'meeting_link'      => $row['meeting_link'],
            'participants'      => $row['participants'],
            'notes'             => $row['notes'],
            'status'            => $row['status'],
            'outcome'           => $row['outcome'],
            'outcome_notes'     => $row['outcome_notes'],
            'requirements'      => $row['requirements'],
            'decisions'         => $row['decisions'],
            'next_action'       => $row['next_action'],
            'next_meeting_date' => $row['next_meeting_date'],
            'assigned_to'       => $row['assigned_to'] !== null ? (int)$row['assigned_to'] : null,
            'assigned_to_name'  => $row['assigned_to_name'] ?? null,
            'completed_at'      => $row['completed_at'],
            'comment_count'     => isset($row['comment_count']) ? (int)$row['comment_count'] : 0,
            'created_at'        => $row['created_at'],
            'updated_at'        => $row['updated_at'],
        ];
    }
}
