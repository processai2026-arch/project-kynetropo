<?php
declare(strict_types=1);

class Vendor
{
    public static function all(array $filters, int $page, int $limit): array
    {
        $page = max(1, $page);
        $limit = min(100, max(1, $limit));
        $where = ['tenant_id = ?'];        // tenant isolation
        $params = [Database::tenantId()];

        if (($filters['active'] ?? null) !== null && $filters['active'] !== '') {
            $where[] = 'is_active = ?';
            $params[] = filter_var($filters['active'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        }

        if (!empty($filters['search'])) {
            $like = '%' . trim((string)$filters['search']) . '%';
            $where[] = '(vendor_code LIKE ? OR name LIKE ? OR gstin LIKE ? OR phone LIKE ?)';
            array_push($params, $like, $like, $like, $like);
        }

        $whereClause = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM vendors WHERE $whereClause", $params);
        $rows = Database::fetchAll(
            "SELECT *
             FROM vendors
             WHERE $whereClause
             ORDER BY is_active DESC, name ASC
             LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );

        return [
            'rows' => array_map([self::class, 'format'], $rows),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => (int)ceil($total / $limit),
            ],
        ];
    }

    public static function findById(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT * FROM vendors WHERE vendor_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );

        return $row ? self::format($row) : null;
    }

    public static function create(array $data): int
    {
        // insertTenant() auto-stamps tenant_id from the current context.
        $id = Database::insertTenant('vendors', [
            'vendor_code'   => $data['vendor_code'] ?: null,
            'name'          => $data['name'],
            'gstin'         => $data['gstin'] ?: null,
            'contact_name'  => $data['contact_name'] ?: null,
            'phone'         => $data['phone'] ?: null,
            'email'         => $data['email'] ?: null,
            'address'       => $data['address'] ?: null,
            'city'          => $data['city'] ?: null,
            'state'         => $data['state'] ?: null,
            'pincode'       => $data['pincode'] ?: null,
            'payment_terms' => $data['payment_terms'] ?: null,
            'notes'         => $data['notes'] ?: null,
            'is_active'     => 1,
            'created_at'    => date('Y-m-d H:i:s'),
        ]);

        if (empty($data['vendor_code'])) {
            Database::execute(
                'UPDATE vendors SET vendor_code = ? WHERE vendor_id = ? AND tenant_id = ?',
                ['VND-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT), $id, Database::tenantId()]
            );
        }

        return $id;
    }

    public static function update(int $id, array $data): void
    {
        $fields = [];
        $params = [];
        $allowed = [
            'vendor_code', 'name', 'gstin', 'contact_name', 'phone', 'email', 'address',
            'city', 'state', 'pincode', 'payment_terms', 'notes', 'is_active',
        ];

        foreach ($allowed as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $fields[] = "$field = ?";
            $params[] = $field === 'is_active' ? (int)(bool)$data[$field] : ($data[$field] ?: null);
        }

        if (empty($fields)) {
            return;
        }

        $params[] = $id;
        $params[] = Database::tenantId();
        Database::execute(
            'UPDATE vendors SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE vendor_id = ? AND tenant_id = ?',
            $params
        );
    }

    public static function deactivate(int $id): void
    {
        Database::execute(
            'UPDATE vendors SET is_active = 0, updated_at = NOW() WHERE vendor_id = ? AND tenant_id = ?',
            [$id, Database::tenantId()]
        );
    }

    public static function existsByCode(string $code, ?int $excludeId = null): bool
    {
        $code = trim($code);
        if ($code === '') {
            return false;
        }

        $sql = 'SELECT vendor_id FROM vendors WHERE tenant_id = ? AND vendor_code = ?';
        $params = [Database::tenantId(), $code];
        if ($excludeId !== null) {
            $sql .= ' AND vendor_id != ?';
            $params[] = $excludeId;
        }
        $sql .= ' LIMIT 1';

        return Database::fetch($sql, $params) !== null;
    }

    public static function duplicateHints(string $name, ?string $gstin, ?int $excludeId = null): array
    {
        $where = [];
        $params = [];
        if ($gstin) {
            $where[] = 'UPPER(gstin) = ?';
            $params[] = strtoupper($gstin);
        }
        if ($name !== '') {
            $where[] = 'LOWER(name) = ?';
            $params[] = strtolower($name);
        }
        if (empty($where)) {
            return [];
        }

        $sql = 'SELECT vendor_id, vendor_code, name, gstin FROM vendors WHERE tenant_id = ? AND (' . implode(' OR ', $where) . ')';
        array_unshift($params, Database::tenantId());
        if ($excludeId !== null) {
            $sql .= ' AND vendor_id != ?';
            $params[] = $excludeId;
        }
        $sql .= ' LIMIT 5';

        return Database::fetchAll($sql, $params);
    }

    public static function format(array $row): array
    {
        return [
            'vendor_id' => (int)$row['vendor_id'],
            'id' => (string)$row['vendor_id'],
            'vendor_code' => $row['vendor_code'],
            'name' => $row['name'],
            'gstin' => $row['gstin'],
            'contact_name' => $row['contact_name'],
            'phone' => $row['phone'],
            'email' => $row['email'],
            'address' => $row['address'],
            'city' => $row['city'],
            'state' => $row['state'],
            'pincode' => $row['pincode'],
            'payment_terms' => $row['payment_terms'],
            'notes' => $row['notes'] ?? null,
            'is_active' => (bool)$row['is_active'],
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }
}
