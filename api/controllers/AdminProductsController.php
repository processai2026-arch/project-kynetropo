<?php
declare(strict_types=1);

/**
 * Admin Product Controller (Consumables Catalog)
 * GET    /admin/products              — list products
 * GET    /admin/products/{id}         — single product
 * POST   /admin/products             — create product
 * PUT    /admin/products/{id}         — update product
 * DELETE /admin/products/{id}         — deactivate product
 */
class AdminProductsController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $sql    = 'SELECT * FROM products WHERE tenant_id = ?';
        $params = [$tenantId];

        if ($cat = $request->query('category')) {
            $sql .= ' AND category = ?'; $params[] = $cat;
        }
        $active = $request->query('active');
        if ($active !== null) {
            $sql .= ' AND is_active = ?'; $params[] = $active === '0' ? 0 : 1;
        }
        if ($q = $request->query('search')) {
            $sql .= ' AND (name LIKE ? OR sku LIKE ?)';
            $like = '%'.$q.'%'; $params[] = $like; $params[] = $like;
        }

        $sql .= ' ORDER BY name ASC';
        $rows = Database::fetchAll($sql, $params);
        Response::success(array_map([$this, 'format'], $rows));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $row      = Database::fetch('SELECT * FROM products WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId]);
        if (!$row) Response::error('Product not found', 404);
        Response::success($this->format($row));
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $name  = trim((string)($body['name']  ?? ''));
        $sku   = trim((string)($body['sku']   ?? ''));
        $price = (float)($body['unit_price']  ?? 0);

        if (!$name)      Response::error('Name is required', 422);
        if (!$sku)       Response::error('SKU is required', 422);
        if ($price <= 0) Response::error('Unit price must be greater than zero', 422);

        $dup = Database::fetch('SELECT id FROM products WHERE sku = ? AND tenant_id = ? LIMIT 1', [$sku, $tenantId]);
        if ($dup) Response::error('SKU already exists', 409);

        $id = Database::insert('products', [
            'tenant_id'  => $tenantId,
            'name'       => $name,
            'sku'        => $sku,
            'category'   => trim((string)($body['category']    ?? '')),
            'description'=> trim((string)($body['description'] ?? '')),
            'unit'       => trim((string)($body['unit']        ?? 'Piece')),
            'unit_price' => $price,
            'stock_qty'  => (int)($body['stock_qty']           ?? 0),
            'is_active'  => isset($body['is_active']) ? ((bool)$body['is_active'] ? 1 : 0) : 1,
        ]);

        $row = Database::fetch('SELECT * FROM products WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $product = Database::fetch('SELECT id FROM products WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId]);
        if (!$product) Response::error('Product not found', 404);

        $updates = [];
        foreach (['name','category','description','unit'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        if (isset($body['unit_price'])) $updates['unit_price'] = (float)$body['unit_price'];
        if (isset($body['stock_qty']))  $updates['stock_qty']  = (int)$body['stock_qty'];
        if (isset($body['is_active']))  $updates['is_active']  = (bool)$body['is_active'] ? 1 : 0;

        if (!empty($updates)) {
            Database::update('products', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch('SELECT * FROM products WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $product = Database::fetch('SELECT id FROM products WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId]);
        if (!$product) Response::error('Product not found', 404);

        Database::update('products', ['is_active' => 0], ['id' => $id, 'tenant_id' => $tenantId]);
        Response::success(['message' => 'Product deactivated']);
    }

    private function format(array $row): array
    {
        return [
            'id'          => (int)$row['id'],
            'name'        => $row['name'],
            'sku'         => $row['sku'],
            'category'    => $row['category'],
            'description' => $row['description'],
            'unit'        => $row['unit'],
            'unit_price'  => (float)$row['unit_price'],
            'stock_qty'   => (int)$row['stock_qty'],
            'is_active'   => (bool)$row['is_active'],
            'created_at'  => $row['created_at'],
        ];
    }
}
