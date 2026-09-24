<?php
declare(strict_types=1);

/**
 * GET    /admin/invoice-products          — list all catalog entries
 * POST   /admin/invoice-products          — create or update by name (upsert)
 * PUT    /admin/invoice-products/{id}     — update a specific entry
 * DELETE /admin/invoice-products/{id}     — delete an entry
 */
class AdminInvoiceProductController
{
    public function index(Request $request): void
    {
        $rows = Database::fetchAll(
            'SELECT id, name, hsn_code, unit_price, gst_rate, unit, created_at, updated_at
               FROM invoice_products
              WHERE tenant_id = ?
              ORDER BY name ASC',
            [Database::tenantId()]
        );
        Response::success($rows);
    }

    // Create or update by name (upsert so duplicates don't pile up)
    public function store(Request $request): void
    {
        $name     = trim(Request::sanitize((string)($request->input('name') ?? '')));
        $hsn      = trim((string)($request->input('hsn_code')  ?? ''));
        $price    = (float)($request->input('unit_price') ?? 0);
        $gstRate  = (int)($request->input('gst_rate')    ?? 18);
        $unit     = trim((string)($request->input('unit') ?? ''));

        if ($name === '') Response::error('Product name is required', 422);
        if (!in_array($gstRate, [0, 5, 12, 18, 28], true)) {
            Response::error('gst_rate must be one of 0, 5, 12, 18, 28', 422);
        }

        $existing = Database::fetch(
            'SELECT id FROM invoice_products WHERE name = ? AND tenant_id = ? LIMIT 1', [$name, Database::tenantId()]
        );

        if ($existing) {
            Database::execute(
                'UPDATE invoice_products
                    SET hsn_code = ?, unit_price = ?, gst_rate = ?, unit = ?, updated_at = NOW()
                  WHERE id = ? AND tenant_id = ?',
                [$hsn ?: null, $price, $gstRate, $unit ?: null, $existing['id'], Database::tenantId()]
            );
            $row = Database::fetch('SELECT * FROM invoice_products WHERE id = ? AND tenant_id = ? LIMIT 1', [$existing['id'], Database::tenantId()]);
            Response::success($row, 'Invoice product updated', 200);
        } else {
            $id = Database::insertTenant('invoice_products', [
                'name' => $name,
                'hsn_code' => $hsn ?: null,
                'unit_price' => $price,
                'gst_rate' => $gstRate,
                'unit' => $unit ?: null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
            $row = Database::fetch('SELECT * FROM invoice_products WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
            Response::success($row, 'Invoice product created', 201);
        }
    }

    public function update(Request $request): void
    {
        $id  = (int)$request->param('id');
        $row = Database::fetch('SELECT id FROM invoice_products WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        if (!$row) Response::error('Invoice product not found', 404);

        $name    = trim(Request::sanitize((string)($request->input('name') ?? '')));
        $hsn     = trim((string)($request->input('hsn_code')  ?? ''));
        $price   = (float)($request->input('unit_price') ?? 0);
        $gstRate = (int)($request->input('gst_rate')    ?? 18);
        $unit    = trim((string)($request->input('unit') ?? ''));

        if ($name === '') Response::error('Product name is required', 422);

        Database::execute(
            'UPDATE invoice_products
                SET name = ?, hsn_code = ?, unit_price = ?, gst_rate = ?, unit = ?, updated_at = NOW()
              WHERE id = ? AND tenant_id = ?',
            [$name, $hsn ?: null, $price, $gstRate, $unit ?: null, $id, Database::tenantId()]
        );
        Response::success(
            Database::fetch('SELECT * FROM invoice_products WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]),
            'Invoice product updated'
        );
    }

    public function destroy(Request $request): void
    {
        $id = (int)$request->param('id');
        if (!Database::fetch('SELECT id FROM invoice_products WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()])) {
            Response::error('Invoice product not found', 404);
        }
        Database::execute('DELETE FROM invoice_products WHERE id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        Response::success(null, 'Invoice product deleted');
    }
}
