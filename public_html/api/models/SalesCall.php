<?php
declare(strict_types=1);

/**
 * SalesCall — a logged call against a lead (spec §9–§11).
 *
 * Outcomes are kept as a configurable VARCHAR + validated allow-list rather
 * than a DB ENUM so the list can grow without a schema migration.
 */
class SalesCall
{
    public const OUTCOMES = [
        'interested',
        'follow_up_required',
        'meeting_required',
        'proposal_required',
        'not_interested',
        'no_response',
        'call_back_later',
        'converted',
        'other',
    ];

    public static function create(array $data, array $actor): int
    {
        return Database::insert('sales_calls', [
            'tenant_id'         => Database::tenantId(),
            'lead_id'           => (int)$data['lead_id'],
            'called_by'         => isset($actor['user_id']) ? (int)$actor['user_id'] : null,
            'called_by_name'    => (string)($actor['name'] ?? ''),
            'call_date'         => $data['call_date'],
            'call_time'         => $data['call_time'] ?? null,
            'duration_minutes'  => max(0, (int)($data['duration_minutes'] ?? 0)),
            'outcome'           => $data['outcome'],
            'notes'             => $data['notes'] ?? null,
            'temperature_after' => $data['temperature_after'] ?? null,
        ]);
    }

    public static function linkFollowup(int $callId, int $followupId): void
    {
        Database::execute(
            'UPDATE sales_calls SET followup_id = ? WHERE id = ? AND tenant_id = ?',
            [$followupId, $callId, Database::tenantId()]
        );
    }

    public static function forLead(int $leadId): array
    {
        $rows = Database::fetchAll(
            'SELECT * FROM sales_calls WHERE tenant_id = ? AND lead_id = ? ORDER BY call_date DESC, (call_time IS NULL), call_time DESC, id DESC',
            [Database::tenantId(), $leadId]
        );
        return array_map([self::class, 'format'], $rows);
    }

    /** Call history across leads, restricted by the caller's lead scope. */
    public static function all(array $filters, array $scope, int $page = 1, int $limit = 50): array
    {
        $page  = max(1, $page);
        $limit = min(200, max(1, $limit));

        $where  = ['c.tenant_id = ?'];
        $params = [Database::tenantId()];

        if ($scope['sql'] !== '') {
            $where[] = ltrim(str_replace('assigned_to', 'l.assigned_to', $scope['sql']), ' AND');
            $params  = array_merge($params, $scope['params']);
        }
        if (!empty($filters['lead_id'])) {
            $where[]  = 'c.lead_id = ?';
            $params[] = (int)$filters['lead_id'];
        }
        if (!empty($filters['outcome'])) {
            $where[]  = 'c.outcome = ?';
            $params[] = $filters['outcome'];
        }
        if (!empty($filters['date_from'])) {
            $where[]  = 'c.call_date >= ?';
            $params[] = $filters['date_from'];
        }
        if (!empty($filters['date_to'])) {
            $where[]  = 'c.call_date <= ?';
            $params[] = $filters['date_to'];
        }

        $whereClause = implode(' AND ', $where);

        $total = Database::count(
            "SELECT COUNT(*) AS cnt FROM sales_calls c
               JOIN sales_leads l ON l.id = c.lead_id AND l.tenant_id = c.tenant_id
              WHERE $whereClause",
            $params
        );

        $rows = Database::fetchAll(
            "SELECT c.*, l.name AS lead_name, l.company AS lead_company, l.temperature AS lead_temperature,
                    (SELECT COUNT(*) FROM sales_comments sc
                      WHERE sc.tenant_id = c.tenant_id AND sc.entity_type = 'call'
                        AND sc.entity_id = c.id AND sc.deleted_at IS NULL) AS comment_count
               FROM sales_calls c
               JOIN sales_leads l ON l.id = c.lead_id AND l.tenant_id = c.tenant_id
              WHERE $whereClause
              ORDER BY c.call_date DESC, (c.call_time IS NULL), c.call_time DESC, c.id DESC
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

    public static function format(array $row): array
    {
        return [
            'id'                => (int)$row['id'],
            'lead_id'           => (int)$row['lead_id'],
            'lead_name'         => $row['lead_name']        ?? null,
            'lead_company'      => $row['lead_company']     ?? null,
            'lead_temperature'  => $row['lead_temperature'] ?? null,
            'called_by'         => $row['called_by'] !== null ? (int)$row['called_by'] : null,
            'called_by_name'    => $row['called_by_name'],
            'call_date'         => $row['call_date'],
            'call_time'         => $row['call_time'],
            'duration_minutes'  => (int)$row['duration_minutes'],
            'outcome'           => $row['outcome'],
            'notes'             => $row['notes'],
            'temperature_after' => $row['temperature_after'],
            'followup_id'       => $row['followup_id'] !== null ? (int)$row['followup_id'] : null,
            'comment_count'     => isset($row['comment_count']) ? (int)$row['comment_count'] : 0,
            'created_at'        => $row['created_at'],
        ];
    }
}
