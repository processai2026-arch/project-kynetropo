<?php
declare(strict_types=1);

class Deal
{
    public const VALID_STAGES = ['qualification', 'proposal', 'negotiation', 'won', 'lost'];

    /** Default probability suggested per stage; the UI can still send its own value. */
    public const STAGE_PROBABILITY = [
        'qualification' => 10,
        'proposal'      => 40,
        'negotiation'   => 65,
        'won'           => 100,
        'lost'          => 0,
    ];

    public static function all(array $filters = [], int $page = 1, int $limit = 50): array
    {
        $page  = max(1, $page);
        $limit = min(100, max(1, $limit));

        $where  = ['d.tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['stage']) && in_array($filters['stage'], self::VALID_STAGES, true)) {
            $where[]  = 'd.stage = ?';
            $params[] = $filters['stage'];
        }
        if (!empty($filters['owner_id'])) {
            $where[]  = 'd.owner_id = ?';
            $params[] = (int)$filters['owner_id'];
        }
        if (!empty($filters['customer_id'])) {
            $where[]  = 'd.customer_id = ?';
            $params[] = (int)$filters['customer_id'];
        }
        if (!empty($filters['search'])) {
            $like     = '%' . trim((string)$filters['search']) . '%';
            $where[]  = '(d.title LIKE ? OR u.name LIKE ?)';
            array_push($params, $like, $like);
        }

        $whereClause = implode(' AND ', $where);
        $total = Database::count(
            "SELECT COUNT(*) AS cnt FROM crm_deals d LEFT JOIN users u ON u.user_id = d.customer_id AND u.tenant_id = d.tenant_id WHERE $whereClause",
            $params
        );
        $rows = Database::fetchAll(
            "SELECT d.*, u.name AS customer_name
               FROM crm_deals d
               LEFT JOIN users u ON u.user_id = d.customer_id AND u.tenant_id = d.tenant_id
              WHERE $whereClause
              ORDER BY d.created_at DESC
              LIMIT ? OFFSET ?",
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

    /** All deals grouped by stage, for the pipeline/kanban board. */
    public static function pipeline(array $filters = []): array
    {
        $where  = ['d.tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['owner_id'])) {
            $where[]  = 'd.owner_id = ?';
            $params[] = (int)$filters['owner_id'];
        }

        $whereClause = implode(' AND ', $where);
        $rows = Database::fetchAll(
            "SELECT d.*, u.name AS customer_name
               FROM crm_deals d
               LEFT JOIN users u ON u.user_id = d.customer_id AND u.tenant_id = d.tenant_id
              WHERE $whereClause
              ORDER BY d.created_at DESC",
            $params
        );

        $board = array_fill_keys(self::VALID_STAGES, []);
        foreach ($rows as $row) {
            $board[$row['stage']][] = self::format($row);
        }
        return $board;
    }

    public static function find(int $id): ?array
    {
        $row = Database::fetch(
            "SELECT d.*, u.name AS customer_name
               FROM crm_deals d
               LEFT JOIN users u ON u.user_id = d.customer_id AND u.tenant_id = d.tenant_id
              WHERE d.deal_id = ? AND d.tenant_id = ? LIMIT 1",
            [$id, Database::tenantId()]
        );
        return $row ? self::format($row) : null;
    }

    public static function findRaw(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM crm_deals WHERE deal_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function create(array $data, ?int $createdBy = null): int
    {
        $stage = $data['stage'] ?? 'qualification';
        return Database::insertTenant('crm_deals', [
            'title'                => $data['title'],
            'customer_id'          => $data['customer_id'] ?? null,
            'lead_id'              => $data['lead_id'] ?? null,
            'value'                => $data['value'] ?? 0,
            'currency'             => $data['currency'] ?? 'INR',
            'stage'                => $stage,
            'expected_close_date'  => $data['expected_close_date'] ?? null,
            'owner_id'             => $data['owner_id'] ?? null,
            'probability'          => $data['probability'] ?? (self::STAGE_PROBABILITY[$stage] ?? 10),
            'notes'                => $data['notes'] ?? null,
            'created_by'           => $createdBy,
            'created_at'           => date('Y-m-d H:i:s'),
        ]);
    }

    public static function update(int $id, array $data): bool
    {
        $columns = ['title', 'customer_id', 'lead_id', 'value', 'currency', 'stage',
                    'expected_close_date', 'owner_id', 'probability', 'notes'];
        $fields  = [];
        $params  = [];

        foreach ($columns as $col) {
            if (array_key_exists($col, $data)) {
                $fields[] = "`$col` = ?";
                $params[] = $data[$col];
            }
        }
        if (!$fields) {
            return false;
        }

        if (isset($data['stage']) && in_array($data['stage'], ['won', 'lost'], true)) {
            $fields[] = 'closed_at = NOW()';
        } elseif (isset($data['stage'])) {
            $fields[] = 'closed_at = NULL';
        }

        $params[] = $id;
        $params[] = Database::tenantId();
        Database::execute(
            'UPDATE crm_deals SET ' . implode(', ', $fields) . ' WHERE deal_id = ? AND tenant_id = ?',
            $params
        );
        return true;
    }

    public static function changeStage(int $id, string $stage): void
    {
        $closedAt = in_array($stage, ['won', 'lost'], true) ? ', closed_at = NOW()' : ', closed_at = NULL';
        Database::execute(
            "UPDATE crm_deals SET stage = ?, probability = ?$closedAt WHERE deal_id = ? AND tenant_id = ?",
            [$stage, self::STAGE_PROBABILITY[$stage] ?? 10, $id, Database::tenantId()]
        );
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM crm_deals WHERE deal_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
    }

    public static function format(array $row): array
    {
        return [
            'deal_id'              => (int)$row['deal_id'],
            'title'                => $row['title'],
            'customer_id'          => $row['customer_id'] !== null ? (int)$row['customer_id'] : null,
            'customer_name'        => $row['customer_name'] ?? null,
            'lead_id'               => $row['lead_id'] !== null ? (int)$row['lead_id'] : null,
            'value'                => (float)$row['value'],
            'currency'             => $row['currency'],
            'stage'                => $row['stage'],
            'expected_close_date'  => $row['expected_close_date'],
            'owner_id'             => $row['owner_id'] !== null ? (int)$row['owner_id'] : null,
            'probability'          => (int)$row['probability'],
            'notes'                => $row['notes'],
            'closed_at'            => $row['closed_at'],
            'created_at'           => $row['created_at'],
            'updated_at'           => $row['updated_at'],
        ];
    }
}
