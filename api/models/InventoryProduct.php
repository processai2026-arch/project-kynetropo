<?php
declare(strict_types=1);

/**
 * Smart Inventory — product master (inventory_products).
 *
 * Note on field mapping: the Prompt-2 API speaks in {product_id, unit_of_measure,
 * cost_price}, but the Prompt-1 schema columns are {inv_product_id, uom,
 * standard_cost}. Controllers pass through the API names; this model maps them to
 * the real columns. Output rows expose both the raw column and a friendly alias so
 * the frontend contract can use either without another query.
 */
class InventoryProduct
{
    public const UNITS = ['kg', 'litre', 'piece', 'box', 'bag'];
    public const TRACKING_TYPES = ['NONE', 'BATCH', 'SERIAL'];

    public static function create(array $data): int
    {
        return Database::insertTenant('inventory_products', [
            'source_product_id' => isset($data['source_product_id']) && $data['source_product_id'] !== ''
                ? (int)$data['source_product_id'] : null,
            'name'             => trim((string)$data['name']),
            'sku'              => trim((string)$data['sku']),
            'category'         => isset($data['category']) ? trim((string)$data['category']) : null,
            'uom'              => trim((string)($data['unit_of_measure'] ?? $data['uom'] ?? 'piece')),
            'hsn_code'         => isset($data['hsn_code']) && $data['hsn_code'] !== '' ? trim((string)$data['hsn_code']) : null,
            'tracking_type'    => strtoupper(trim((string)($data['tracking_type'] ?? 'NONE'))),
            'requires_expiry'  => isset($data['requires_expiry']) ? (int)(bool)$data['requires_expiry'] : 0,
            'reorder_level'    => (float)($data['reorder_level'] ?? 0),
            'reorder_quantity' => (float)($data['reorder_quantity'] ?? 0),
            'standard_cost'    => (float)($data['cost_price'] ?? $data['standard_cost'] ?? 0),
            'selling_price'    => (float)($data['selling_price'] ?? 0),
            'is_active'        => isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1,
            'created_by'       => isset($data['created_by']) ? (int)$data['created_by'] : null,
        ]);
    }

    public static function update(int $id, array $data): bool
    {
        $fields = [];
        $params = [];

        $map = [
            'name'             => 'name',
            'sku'              => 'sku',
            'category'         => 'category',
            'unit_of_measure'  => 'uom',
            'uom'              => 'uom',
            'hsn_code'         => 'hsn_code',
            'tracking_type'    => 'tracking_type',
            'requires_expiry'  => 'requires_expiry',
            'reorder_level'    => 'reorder_level',
            'reorder_quantity' => 'reorder_quantity',
            'cost_price'       => 'standard_cost',
            'standard_cost'    => 'standard_cost',
            'selling_price'    => 'selling_price',
            'source_product_id'=> 'source_product_id',
            'is_active'        => 'is_active',
        ];

        foreach ($map as $in => $col) {
            if (!array_key_exists($in, $data)) {
                continue;
            }
            $value = $data[$in];
            if (in_array($col, ['reorder_level', 'reorder_quantity', 'standard_cost', 'selling_price'], true)) {
                $value = (float)$value;
            } elseif (in_array($col, ['source_product_id', 'is_active', 'requires_expiry'], true)) {
                $value = $value === '' || $value === null ? null : (int)$value;
            } else {
                $value = $value === null ? null : trim((string)$value);
            }
            $fields[] = "$col = ?";
            $params[] = $value;
        }

        if (!$fields) {
            return false;
        }

        $params[] = $id;
        $params[] = Database::tenantId();
        return Database::execute(
            "UPDATE inventory_products SET " . implode(', ', $fields) . "
             WHERE inv_product_id = ? AND is_deleted = 0 AND tenant_id = ?",
            $params
        ) >= 0;
    }

    public static function findById(int $id): ?array
    {
        $row = Database::fetch(
            "SELECT * FROM inventory_products
             WHERE inv_product_id = ? AND is_deleted = 0 AND tenant_id = ?
             LIMIT 1",
            [$id, Database::tenantId()]
        );
        return $row ? self::format($row) : null;
    }

    public static function findBySku(string $sku): ?array
    {
        $row = Database::fetch(
            "SELECT * FROM inventory_products
             WHERE sku = ? AND is_deleted = 0 AND tenant_id = ?
             LIMIT 1",
            [trim($sku), Database::tenantId()]
        );
        return $row ? self::format($row) : null;
    }

    public static function getAll(array $filters = []): array
    {
        $where = ['p.is_deleted = 0', 'p.tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['search'])) {
            $like = '%' . trim((string)$filters['search']) . '%';
            $where[] = '(p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?)';
            array_push($params, $like, $like, $like);
        }
        if (!empty($filters['category'])) {
            $where[] = 'p.category = ?';
            $params[] = trim((string)$filters['category']);
        }
        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $where[] = 'p.is_active = ?';
            $params[] = (int)(bool)$filters['is_active'];
        }

        $whereClause = implode(' AND ', $where);
        // The inventory_stock subquery is scoped by tenant; its bound value is
        // prepended so it precedes the outer WHERE params.
        $rows = Database::fetchAll(
            "SELECT p.*,
                    COALESCE(s.current_quantity, 0)   AS current_quantity,
                    COALESCE(s.available_quantity, 0) AS available_quantity,
                    COALESCE(s.health_score, 0)       AS health_score
             FROM inventory_products p
             LEFT JOIN (
                 SELECT inv_product_id,
                        SUM(current_quantity)   AS current_quantity,
                        SUM(available_quantity) AS available_quantity,
                        CASE WHEN SUM(current_quantity) > 0
                             THEN SUM(health_score * current_quantity) / SUM(current_quantity)
                             ELSE AVG(health_score)
                        END AS health_score
                 FROM inventory_stock
                 WHERE tenant_id = ?
                 GROUP BY inv_product_id
             ) s ON s.inv_product_id = p.inv_product_id
             WHERE $whereClause
             ORDER BY p.name ASC, p.inv_product_id DESC",
            [Database::tenantId(), ...$params]
        );

        return array_map([self::class, 'format'], $rows);
    }

    public static function softDelete(int $id): bool
    {
        return Database::execute(
            "UPDATE inventory_products
             SET is_deleted = 1, is_active = 0
             WHERE inv_product_id = ? AND is_deleted = 0 AND tenant_id = ?",
            [$id, Database::tenantId()]
        ) > 0;
    }

    public static function existsBySku(string $sku, int $excludeId = 0): bool
    {
        return Database::count(
            "SELECT COUNT(*) AS cnt FROM inventory_products
             WHERE sku = ? AND is_deleted = 0 AND inv_product_id <> ? AND tenant_id = ?",
            [trim($sku), $excludeId, Database::tenantId()]
        ) > 0;
    }

    private static function format(array $row): array
    {
        // Expose both the real column and the API alias so either contract works.
        $row['product_id']      = (int)$row['inv_product_id'];
        $row['unit_of_measure'] = $row['uom'];
        $row['cost_price']      = $row['standard_cost'];
        $row['is_active']       = (int)$row['is_active'] === 1;
        $row['tracking_type']   = strtoupper((string)($row['tracking_type'] ?? 'NONE'));
        $row['requires_expiry'] = (int)($row['requires_expiry'] ?? 0) === 1;
        return $row;
    }
}
