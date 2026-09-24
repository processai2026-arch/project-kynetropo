<?php
declare(strict_types=1);

class CrmActivity
{
    public const VALID_TYPES         = ['call', 'meeting', 'task', 'note'];
    public const VALID_RELATED_TYPES = ['lead', 'deal', 'customer'];

    public static function all(array $filters = [], int $page = 1, int $limit = 50): array
    {
        $page  = max(1, $page);
        $limit = min(100, max(1, $limit));

        $where  = ['tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['related_type']) && in_array($filters['related_type'], self::VALID_RELATED_TYPES, true)) {
            $where[]  = 'related_type = ?';
            $params[] = $filters['related_type'];
        }
        if (!empty($filters['related_id'])) {
            $where[]  = 'related_id = ?';
            $params[] = (int)$filters['related_id'];
        }
        if (!empty($filters['type']) && in_array($filters['type'], self::VALID_TYPES, true)) {
            $where[]  = 'type = ?';
            $params[] = $filters['type'];
        }
        if (isset($filters['done']) && $filters['done'] !== '') {
            $where[]  = 'done = ?';
            $params[] = $filters['done'] ? 1 : 0;
        }
        if (!empty($filters['owner_id'])) {
            $where[]  = 'owner_id = ?';
            $params[] = (int)$filters['owner_id'];
        }

        $whereClause = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM crm_activities WHERE $whereClause", $params);
        $rows  = Database::fetchAll(
            "SELECT * FROM crm_activities WHERE $whereClause ORDER BY COALESCE(due_at, created_at) DESC LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );

        return [
            'rows' => array_map([self::class, 'format'], $rows),
            'pagination' => [
                'page'        => $page,
                'limit'       => $limit,
                'total'       => $total,
                'total_pages' => (int)ceil($total / $limit),
            ],
        ];
    }

    /** Unified timeline for one record (lead/deal/customer), newest first. */
    public static function timeline(string $relatedType, int $relatedId): array
    {
        $rows = Database::fetchAll(
            'SELECT * FROM crm_activities WHERE related_type = ? AND related_id = ? AND tenant_id = ? ORDER BY created_at DESC',
            [$relatedType, $relatedId, Database::tenantId()]
        );
        return array_map([self::class, 'format'], $rows);
    }

    public static function find(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT * FROM crm_activities WHERE activity_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
        return $row ? self::format($row) : null;
    }

    public static function create(array $data, ?int $createdBy = null): int
    {
        return Database::insertTenant('crm_activities', [
            'type'         => $data['type'] ?? 'task',
            'subject'      => $data['subject'],
            'notes'        => $data['notes'] ?? null,
            'related_type' => $data['related_type'],
            'related_id'   => $data['related_id'],
            'due_at'       => $data['due_at'] ?? null,
            'done'         => !empty($data['done']) ? 1 : 0,
            'done_at'      => !empty($data['done']) ? date('Y-m-d H:i:s') : null,
            'owner_id'     => $data['owner_id'] ?? null,
            'created_by'   => $createdBy,
            'created_at'   => date('Y-m-d H:i:s'),
        ]);
    }

    public static function update(int $id, array $data): bool
    {
        $columns = ['type', 'subject', 'notes', 'due_at', 'owner_id'];
        $fields  = [];
        $params  = [];

        foreach ($columns as $col) {
            if (array_key_exists($col, $data)) {
                $fields[] = "`$col` = ?";
                $params[] = $data[$col];
            }
        }

        if (array_key_exists('done', $data)) {
            $fields[] = 'done = ?';
            $params[] = !empty($data['done']) ? 1 : 0;
            $fields[] = 'done_at = ?';
            $params[] = !empty($data['done']) ? date('Y-m-d H:i:s') : null;
        }

        if (!$fields) {
            return false;
        }

        $params[] = $id;
        $params[] = Database::tenantId();
        Database::execute(
            'UPDATE crm_activities SET ' . implode(', ', $fields) . ' WHERE activity_id = ? AND tenant_id = ?',
            $params
        );
        return true;
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM crm_activities WHERE activity_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
    }

    public static function format(array $row): array
    {
        return [
            'activity_id'  => (int)$row['activity_id'],
            'type'         => $row['type'],
            'subject'      => $row['subject'],
            'notes'        => $row['notes'],
            'related_type' => $row['related_type'],
            'related_id'   => (int)$row['related_id'],
            'due_at'       => $row['due_at'],
            'done'         => (bool)$row['done'],
            'done_at'      => $row['done_at'],
            'owner_id'     => $row['owner_id'] !== null ? (int)$row['owner_id'] : null,
            'created_at'   => $row['created_at'],
            'updated_at'   => $row['updated_at'],
        ];
    }
}
