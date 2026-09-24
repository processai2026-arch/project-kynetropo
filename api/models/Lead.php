<?php
declare(strict_types=1);

class Lead
{
    public const VALID_STATUSES = ['new', 'contacted', 'qualified', 'lost'];
    public const VALID_SOURCES  = ['website', 'referral', 'cold_call', 'email', 'social', 'event', 'other'];

    public static function all(array $filters = [], int $page = 1, int $limit = 50): array
    {
        $page  = max(1, $page);
        $limit = min(100, max(1, $limit));

        $where  = ['tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['status']) && in_array($filters['status'], self::VALID_STATUSES, true)) {
            $where[]  = 'status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['owner_id'])) {
            $where[]  = 'owner_id = ?';
            $params[] = (int)$filters['owner_id'];
        }
        if (!empty($filters['source'])) {
            $where[]  = 'source = ?';
            $params[] = $filters['source'];
        }
        if (!empty($filters['search'])) {
            $like     = '%' . trim((string)$filters['search']) . '%';
            $where[]  = '(name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            array_push($params, $like, $like, $like, $like);
        }

        $whereClause = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM crm_leads WHERE $whereClause", $params);
        $rows  = Database::fetchAll(
            "SELECT * FROM crm_leads WHERE $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?",
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

    public static function find(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT * FROM crm_leads WHERE lead_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
        return $row ? self::format($row) : null;
    }

    public static function findRaw(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM crm_leads WHERE lead_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function create(array $data, ?int $createdBy = null): int
    {
        return Database::insertTenant('crm_leads', [
            'name'         => $data['name'],
            'company_name' => $data['company_name'] ?? null,
            'email'        => $data['email'] ?? null,
            'phone'        => $data['phone'] ?? null,
            'source'       => $data['source'] ?? null,
            'status'       => $data['status'] ?? 'new',
            'owner_id'     => $data['owner_id'] ?? null,
            'notes'        => $data['notes'] ?? null,
            'created_by'   => $createdBy,
            'created_at'   => date('Y-m-d H:i:s'),
        ]);
    }

    public static function update(int $id, array $data): bool
    {
        $columns = ['name', 'company_name', 'email', 'phone', 'source', 'status', 'owner_id', 'notes'];
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

        $params[] = $id;
        $params[] = Database::tenantId();
        Database::execute(
            'UPDATE crm_leads SET ' . implode(', ', $fields) . ' WHERE lead_id = ? AND tenant_id = ?',
            $params
        );
        return true;
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM crm_leads WHERE lead_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
    }

    public static function markConverted(int $id, int $customerId, ?int $dealId): void
    {
        Database::execute(
            "UPDATE crm_leads
                SET status = 'qualified', converted_customer_id = ?, converted_deal_id = ?, converted_at = NOW()
              WHERE lead_id = ? AND tenant_id = ?",
            [$customerId, $dealId, $id, Database::tenantId()]
        );
    }

    public static function format(array $row): array
    {
        return [
            'lead_id'               => (int)$row['lead_id'],
            'name'                  => $row['name'],
            'company_name'          => $row['company_name'],
            'email'                 => $row['email'],
            'phone'                 => $row['phone'],
            'source'                => $row['source'],
            'status'                => $row['status'],
            'owner_id'              => $row['owner_id'] !== null ? (int)$row['owner_id'] : null,
            'notes'                 => $row['notes'],
            'converted_customer_id' => $row['converted_customer_id'] !== null ? (int)$row['converted_customer_id'] : null,
            'converted_deal_id'     => $row['converted_deal_id'] !== null ? (int)$row['converted_deal_id'] : null,
            'converted_at'          => $row['converted_at'],
            'created_at'            => $row['created_at'],
            'updated_at'            => $row['updated_at'],
        ];
    }
}
