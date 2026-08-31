<?php
declare(strict_types=1);

/**
 * Admin Invoice Product Mapping Controller
 * POST /admin/invoice-product-mappings/check  — check unmapped SKUs
 * GET  /admin/invoice-product-mappings         — list mappings
 * POST /admin/invoice-product-mappings         — create mapping
 * DELETE /admin/invoice-product-mappings/{id}  — delete mapping
 */
class AdminInvoiceProductMappingController
{
    public function check(Request $request): void
    {
        $tid  = Database::tenantId();
        $skus = $request->input('skus');
        if (!is_array($skus) || empty($skus)) {
            Response::error('skus must be a non-empty array', 422);
        }
        $unmapped = [];
        foreach ($skus as $sku) {
            $sku = trim((string)$sku);
            if ($sku === '') continue;
            $exists = Database::fetch(
                'SELECT mapping_id FROM invoice_product_mappings WHERE tenant_id = ? AND extracted_name = ? LIMIT 1',
                [$tid, $sku]
            );
            if (!$exists) $unmapped[] = $sku;
        }
        Response::success(['unmapped' => $unmapped, 'unmapped_count' => count($unmapped)]);
    }

    public function index(Request $request): void
    {
        $tid  = Database::tenantId();
        $rows = Database::fetchAll(
            'SELECT m.*, p.sku AS product_sku, p.name AS product_name
             FROM invoice_product_mappings m
             JOIN invoice_products p ON p.product_id = m.product_id AND p.tenant_id = m.tenant_id
             WHERE m.tenant_id = ?
             ORDER BY m.extracted_name ASC',
            [$tid]
        );
        Response::success($rows);
    }

    public function store(Request $request): void
    {
        $tid           = Database::tenantId();
        $extractedName = trim((string)($request->input('extracted_name') ?? ''));
        $productId     = (int)($request->input('product_id') ?? 0);
        if ($extractedName === '' || $productId <= 0) {
            Response::error('extracted_name and product_id are required', 422);
        }
        if (!Database::fetch('SELECT product_id FROM invoice_products WHERE product_id = ? AND tenant_id = ?', [$productId, $tid])) {
            Response::error('Product not found', 404);
        }
        // Upsert — if name already mapped, update the product_id
        $existing = Database::fetch(
            'SELECT mapping_id FROM invoice_product_mappings WHERE tenant_id = ? AND extracted_name = ? LIMIT 1',
            [$tid, $extractedName]
        );
        if ($existing) {
            Database::execute(
                'UPDATE invoice_product_mappings SET product_id = ?, updated_at = NOW() WHERE mapping_id = ? AND tenant_id = ?',
                [$productId, $existing['mapping_id'], $tid]
            );
            $id = (int)$existing['mapping_id'];
        } else {
            $id = Database::insert(
                'INSERT INTO invoice_product_mappings (tenant_id, extracted_name, product_id, created_at) VALUES (?, ?, ?, NOW())',
                [$tid, $extractedName, $productId]
            );
        }
        $row = Database::fetch(
            'SELECT m.*, p.sku AS product_sku, p.name AS product_name
             FROM invoice_product_mappings m
             JOIN invoice_products p ON p.product_id = m.product_id AND p.tenant_id = m.tenant_id
             WHERE m.mapping_id = ?',
            [$id]
        );
        Response::success($row, 'Mapping saved', 201);
    }

    public function destroy(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        if ($id <= 0 || !Database::fetch('SELECT mapping_id FROM invoice_product_mappings WHERE mapping_id = ? AND tenant_id = ?', [$id, $tid])) {
            Response::error('Mapping not found', 404);
        }
        Database::execute('DELETE FROM invoice_product_mappings WHERE mapping_id = ? AND tenant_id = ?', [$id, $tid]);
        Response::success(null, 'Mapping deleted');
    }
}
