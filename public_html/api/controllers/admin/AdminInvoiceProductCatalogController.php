<?php
declare(strict_types=1);

/**
 * Admin Invoice Products Controller (marketplace product catalog)
 * GET    /admin/invoice-products/low-stock  — products at or below min stock
 * GET    /admin/invoice-products            — list with filters + pagination
 * POST   /admin/invoice-products            — create
 * GET    /admin/invoice-products/{id}       — single product
 * PUT    /admin/invoice-products/{id}       — update
 * DELETE /admin/invoice-products/{id}       — delete
 */
class AdminInvoiceProductCatalogController
{
    // ─── GET /admin/invoice-products/low-stock ────────────────────────────────
    public function lowStock(Request $request): void
    {
        $tid  = Database::tenantId();
        $rows = Database::fetchAll(
            'SELECT * FROM invoice_products
             WHERE tenant_id = ? AND is_active = 1 AND current_stock <= min_stock_level
             ORDER BY current_stock ASC',
            [$tid]
        );
        foreach ($rows as &$r) {
            $r['cost_price']       = (float)$r['cost_price'];
            $r['selling_price']    = (float)$r['selling_price'];
            $r['input_gst_rate']   = (float)($r['input_gst_rate'] ?? 0);
            $r['input_gst_amount'] = (float)($r['input_gst_amount'] ?? 0);
            $r['damaged_stock']    = (int)($r['damaged_stock'] ?? 0);
            $r['is_active']        = (bool)$r['is_active'];
        }
        Response::success($rows);
    }

    // ─── GET /admin/invoice-products ─────────────────────────────────────────
    public function index(Request $request): void
    {
        $page  = max(1, (int)$request->query('page', 1));
        $limit = min(500, max(1, (int)$request->query('limit', 20)));
        $tid   = Database::tenantId();

        $where  = ['tenant_id = ?'];
        $params = [$tid];

        if ($search = $request->query('search')) {
            $like     = '%' . trim($search) . '%';
            $where[]  = '(name LIKE ? OR sku LIKE ? OR category LIKE ?)';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }
        if ($cat = $request->query('category')) {
            $where[]  = 'category = ?';
            $params[] = $cat;
        }
        $stockLevel = $request->query('stock_level');
        if ($stockLevel === 'low') {
            $where[] = 'current_stock > 0 AND current_stock <= min_stock_level';
        } elseif ($stockLevel === 'zero') {
            $where[] = 'current_stock <= 0';
        } elseif ($stockLevel === 'normal') {
            $where[] = 'current_stock > min_stock_level';
        }

        $wc     = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM invoice_products WHERE $wc", $params);
        $offset = ($page - 1) * $limit;

        $rows = Database::fetchAll(
            "SELECT * FROM invoice_products WHERE $wc ORDER BY name ASC LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );
        foreach ($rows as &$r) {
            $r['cost_price']       = (float)$r['cost_price'];
            $r['selling_price']    = (float)$r['selling_price'];
            $r['input_gst_rate']   = (float)($r['input_gst_rate'] ?? 0);
            $r['input_gst_amount'] = (float)($r['input_gst_amount'] ?? 0);
            $r['damaged_stock']    = (int)($r['damaged_stock'] ?? 0);
            $r['is_active']        = (bool)$r['is_active'];
        }
        Response::paginated($rows, [
            'page'        => $page,
            'limit'       => $limit,
            'total'       => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }

    // ─── POST /admin/invoice-products ─────────────────────────────────────────
    public function store(Request $request): void
    {
        $tid = Database::tenantId();
        $sku = trim((string)($request->input('sku') ?? ''));
        $name = trim((string)($request->input('name') ?? ''));
        if ($sku === '' || $name === '') {
            Response::error('sku and name are required', 422);
        }
        if (Database::fetch('SELECT product_id FROM invoice_products WHERE tenant_id = ? AND sku = ? LIMIT 1', [$tid, $sku])) {
            Response::error('SKU already exists', 409);
        }
        $id = Database::insert(
            'INSERT INTO invoice_products
                (tenant_id, sku, name, description, category, hsn_code, input_gst_rate, input_gst_amount, unit,
                 cost_price, selling_price, current_stock, damaged_stock, min_stock_level, max_stock_level, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())',
            [
                $tid,
                $sku,
                $name,
                $request->input('description') ? Request::sanitize((string)$request->input('description')) : null,
                $request->input('category') ? Request::sanitize((string)$request->input('category')) : null,
                $request->input('hsn_code') ? trim((string)$request->input('hsn_code')) : null,
                (float)($request->input('input_gst_rate') ?? 0),
                (float)($request->input('input_gst_amount') ?? 0),
                $request->input('unit') ? trim((string)$request->input('unit')) : 'pcs',
                (float)($request->input('cost_price') ?? 0),
                (float)($request->input('selling_price') ?? 0),
                (int)($request->input('current_stock') ?? 0),
                (int)($request->input('damaged_stock') ?? 0),
                (int)($request->input('min_stock_level') ?? 5),
                (int)($request->input('max_stock_level') ?? 100),
            ]
        );
        $row = $this->findOrFail($id);
        Response::success($row, 'Product created', 201);
    }

    // ─── GET /admin/invoice-products/{id} ────────────────────────────────────
    public function show(Request $request): void
    {
        Response::success($this->findOrFail((int)$request->param('id')));
    }

    // ─── PUT /admin/invoice-products/{id} ────────────────────────────────────
    public function update(Request $request): void
    {
        $id  = (int)$request->param('id');
        $this->findOrFail($id);

        $allowed = ['name','description','category','hsn_code','input_gst_rate','input_gst_amount','unit','cost_price',
                    'selling_price','current_stock','damaged_stock','min_stock_level','max_stock_level','is_active'];
        $sets = []; $params = [];
        foreach ($allowed as $col) {
            $val = $request->input($col);
            if ($val === null) continue;
            if (in_array($col, ['name','description','category'], true)) {
                $val = Request::sanitize(trim((string)$val));
            } elseif (in_array($col, ['cost_price','selling_price','input_gst_rate','input_gst_amount'], true)) {
                $val = (float)$val;
            } elseif (in_array($col, ['current_stock','damaged_stock','min_stock_level','max_stock_level','is_active'], true)) {
                $val = (int)$val;
            }
            $sets[] = "$col = ?"; $params[] = $val;
        }
        if (empty($sets)) Response::error('No fields to update', 400);
        $sets[] = 'updated_at = NOW()';
        $params[] = $id; $params[] = Database::tenantId();
        Database::execute('UPDATE invoice_products SET ' . implode(', ', $sets) . ' WHERE product_id = ? AND tenant_id = ?', $params);
        Response::success($this->findOrFail($id), 'Product updated');
    }

    // ─── DELETE /admin/invoice-products/{id} ────────────────────────────────
    public function destroy(Request $request): void
    {
        $id = (int)$request->param('id');
        $this->findOrFail($id);
        Database::execute('DELETE FROM invoice_products WHERE product_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        Response::success(null, 'Product deleted');
    }

    private function findOrFail(int $id): array
    {
        if ($id <= 0) Response::error('Invalid ID', 400);
        $row = Database::fetch('SELECT * FROM invoice_products WHERE product_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        if (!$row) Response::error('Product not found', 404);
        $row['cost_price']      = (float)$row['cost_price'];
        $row['selling_price']   = (float)$row['selling_price'];
        $row['input_gst_rate']  = (float)($row['input_gst_rate'] ?? 0);
        $row['input_gst_amount']= (float)($row['input_gst_amount'] ?? 0);
        $row['damaged_stock']   = (int)($row['damaged_stock'] ?? 0);
        $row['is_active']       = (bool)$row['is_active'];
        return $row;
    }
}
