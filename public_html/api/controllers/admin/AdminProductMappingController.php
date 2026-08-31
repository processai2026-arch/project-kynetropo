<?php
declare(strict_types=1);

/**
 * Admin Product Mapping Controller — two-table combo-product mapping
 *
 * GET  /admin/product-mappings/check          — check names against mappings
 * GET  /admin/product-mappings                — list all with items
 * POST /admin/product-mappings                — create mapping + items
 * GET  /admin/product-mappings/{id}           — single mapping with items
 * PUT  /admin/product-mappings/{id}           — replace all items
 * DELETE /admin/product-mappings/{id}         — delete mapping + cascade items
 *
 * Name normalization: lowercase, collapse spaces, strip all quote chars
 * Supports combo products: "FASHION KIT × 1" → SKU-A × 1 + SKU-B × 1
 */
class AdminProductMappingController
{
    // ─── POST /admin/product-mappings/check ──────────────────────────────────
    // { product_names: ["Name A", "Name B"] } → { "Name A": mapping_obj|null, ... }
    public function check(Request $request): void
    {
        $tid   = Database::tenantId();
        $names = $request->input('product_names') ?? $request->input('skus') ?? [];
        if (!is_array($names)) $names = [];

        $result = [];
        foreach ($names as $name) {
            $normalized = self::normalizeName((string)$name);
            $mapping = Database::fetch(
                'SELECT mapping_id, invoice_product_name FROM product_mappings WHERE tenant_id = ? AND invoice_product_name = ? LIMIT 1',
                [$tid, $normalized]
            );
            if ($mapping) {
                $items = $this->loadItems((int)$mapping['mapping_id']);
                $result[$name] = ['mapping_id' => $mapping['mapping_id'], 'invoice_product_name' => $name, 'items' => $items];
            } else {
                $result[$name] = null;
            }
        }

        // Also return unmapped list for backward compatibility
        $unmapped = array_keys(array_filter($result, fn($v) => $v === null));
        Response::success(['mappings' => $result, 'unmapped' => $unmapped, 'unmapped_count' => count($unmapped)]);
    }

    // ─── GET /admin/product-mappings ─────────────────────────────────────────
    public function index(Request $request): void
    {
        $tid  = Database::tenantId();
        $rows = Database::fetchAll(
            'SELECT mapping_id, invoice_product_name, created_at, updated_at
             FROM product_mappings WHERE tenant_id = ? ORDER BY invoice_product_name ASC',
            [$tid]
        );
        foreach ($rows as &$m) {
            $m['items'] = $this->loadItems((int)$m['mapping_id']);
        }
        Response::success($rows);
    }

    // ─── POST /admin/product-mappings ────────────────────────────────────────
    // { invoice_product_name: "...", items: [{product_id: N, quantity: 1.0}, ...] }
    public function store(Request $request): void
    {
        $tid  = Database::tenantId();
        $name = trim((string)($request->input('invoice_product_name') ?? ''));
        if ($name === '') Response::error('invoice_product_name is required', 422);

        $items = $request->input('items');
        if (!is_array($items) || empty($items)) Response::error('items must be a non-empty array', 422);

        $normalized = self::normalizeName($name);

        // Check duplicate
        if (Database::fetch('SELECT mapping_id FROM product_mappings WHERE tenant_id = ? AND invoice_product_name = ? LIMIT 1', [$tid, $normalized])) {
            Response::error('A mapping for this product name already exists', 409);
        }

        Database::beginTransaction();
        try {
            $mappingId = Database::insert(
                'INSERT INTO product_mappings (tenant_id, invoice_product_name, created_at) VALUES (?, ?, NOW())',
                [$tid, $normalized]
            );
            $this->insertItems($mappingId, $tid, $items);
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to create mapping: ' . $e->getMessage(), 500);
        }

        $row = $this->findOrFail($mappingId, $tid);
        Response::success($row, 'Mapping created', 201);
    }

    // ─── GET /admin/product-mappings/{id} ────────────────────────────────────
    public function show(Request $request): void
    {
        Response::success($this->findOrFail((int)$request->param('id'), Database::tenantId()));
    }

    // ─── PUT /admin/product-mappings/{id} — replace all items ────────────────
    public function update(Request $request): void
    {
        $id   = (int)$request->param('id');
        $tid  = Database::tenantId();
        $this->findOrFail($id, $tid);

        $items = $request->input('items');
        if (!is_array($items) || empty($items)) Response::error('items must be a non-empty array', 422);

        Database::beginTransaction();
        try {
            Database::execute('DELETE FROM product_mapping_items WHERE mapping_id = ? AND tenant_id = ?', [$id, $tid]);
            $this->insertItems($id, $tid, $items);
            Database::execute('UPDATE product_mappings SET updated_at = NOW() WHERE mapping_id = ? AND tenant_id = ?', [$id, $tid]);
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to update mapping: ' . $e->getMessage(), 500);
        }

        Response::success($this->findOrFail($id, $tid), 'Mapping updated');
    }

    // ─── DELETE /admin/product-mappings/{id} ─────────────────────────────────
    public function destroy(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $this->findOrFail($id, $tid);
        // Items cascade via FK
        Database::execute('DELETE FROM product_mappings WHERE mapping_id = ? AND tenant_id = ?', [$id, $tid]);
        Response::success(null, 'Mapping deleted');
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    public static function normalizeName(string $name): string
    {
        $name = mb_strtolower($name, 'UTF-8');
        // Strip all quote characters (straight + curly + backtick)
        $name = preg_replace('/[\x{201C}\x{201D}\x{2018}\x{2019}"\'\`]/u', '', $name);
        // Collapse multiple spaces
        $name = preg_replace('/\s+/', ' ', $name);
        return trim($name);
    }

    private function loadItems(int $mappingId): array
    {
        $items = Database::fetchAll(
            'SELECT pmi.item_id, pmi.product_id, pmi.quantity,
                    p.sku AS product_sku, p.name AS product_name
             FROM product_mapping_items pmi
             JOIN invoice_products p ON p.product_id = pmi.product_id AND p.tenant_id = pmi.tenant_id
             WHERE pmi.mapping_id = ?
             ORDER BY pmi.item_id ASC',
            [$mappingId]
        );
        foreach ($items as &$it) { $it['quantity'] = (float)$it['quantity']; }
        return $items;
    }

    private function insertItems(int $mappingId, int $tid, array $items): void
    {
        foreach ($items as $idx => $item) {
            $productId = (int)($item['product_id'] ?? 0);
            $qty       = (float)($item['quantity'] ?? 1.0);
            if ($productId <= 0) continue;
            if (!Database::fetch('SELECT product_id FROM invoice_products WHERE product_id = ? AND tenant_id = ? LIMIT 1', [$productId, $tid])) {
                Response::error("items[$idx].product_id {$productId} not found", 422);
            }
            Database::insert(
                'INSERT INTO product_mapping_items (mapping_id, tenant_id, product_id, quantity, created_at) VALUES (?, ?, ?, ?, NOW())',
                [$mappingId, $tid, $productId, max(0.001, $qty)]
            );
        }
    }

    private function findOrFail(int $id, int $tid): array
    {
        if ($id <= 0) Response::error('Invalid ID', 400);
        $row = Database::fetch(
            'SELECT mapping_id, invoice_product_name, created_at, updated_at
             FROM product_mappings WHERE mapping_id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tid]
        );
        if (!$row) Response::error('Mapping not found', 404);
        $row['items'] = $this->loadItems($id);
        return $row;
    }
}
