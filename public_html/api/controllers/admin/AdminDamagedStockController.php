<?php
declare(strict_types=1);

/**
 * Admin Damaged Stock Controller
 * Reads from invoice_products.damaged_stock column (primary) + damaged_stock table (legacy)
 * GET  /admin/damaged-stock/summary — totals
 * GET  /admin/damaged-stock         — list products with damaged_stock > 0
 * POST /admin/damaged-stock/{id}/write-off — write off, journal entry, expense
 */
class AdminDamagedStockController
{
    public function summary(Request $request): void
    {
        $tid = Database::tenantId();

        // Read from invoice_products.damaged_stock (primary source)
        $row = Database::fetch(
            'SELECT COALESCE(SUM(damaged_stock), 0) AS total_damaged_units,
                    COALESCE(SUM(damaged_stock * cost_price), 0) AS total_damaged_value,
                    COUNT(CASE WHEN damaged_stock > 0 THEN 1 END) AS product_count
             FROM invoice_products WHERE tenant_id = ? AND is_active = 1',
            [$tid]
        );

        Response::success([
            'total_damaged_units'  => (int)($row['total_damaged_units'] ?? 0),
            'total_damaged_value'  => (float)($row['total_damaged_value'] ?? 0),
            'product_count'        => (int)($row['product_count'] ?? 0),
        ]);
    }

    public function index(Request $request): void
    {
        $tid  = Database::tenantId();
        // List products that have damaged_stock > 0 (from invoice_products column)
        $rows = Database::fetchAll(
            'SELECT product_id AS id, sku, name AS product_name, category,
                    damaged_stock AS damaged_qty, cost_price,
                    (damaged_stock * cost_price) AS total_value, created_at
             FROM invoice_products
             WHERE tenant_id = ? AND is_active = 1 AND damaged_stock > 0
             ORDER BY damaged_stock DESC',
            [$tid]
        );
        foreach ($rows as &$r) {
            $r['damaged_qty']  = (int)$r['damaged_qty'];
            $r['cost_price']   = (float)$r['cost_price'];
            $r['total_value']  = (float)$r['total_value'];
        }
        Response::success($rows);
    }

    public function writeOff(Request $request): void
    {
        $id  = (int)$request->param('id');  // product_id
        $tid = Database::tenantId();

        $prod = Database::fetch(
            'SELECT product_id, sku, name, damaged_stock, cost_price FROM invoice_products
             WHERE product_id = ? AND tenant_id = ? AND damaged_stock > 0 LIMIT 1',
            [$id, $tid]
        );
        if (!$prod) Response::error('Product not found or has no damaged stock', 404);

        $damagedQty   = (int)$prod['damaged_stock'];
        $costPrice    = (float)$prod['cost_price'];
        $lossAmount   = round($damagedQty * $costPrice, 2);
        $entryDate    = date('Y-m-d');
        $userId       = $request->user['user_id'] ?? null;

        Database::beginTransaction();
        try {
            // 1. Zero out damaged_stock on product
            Database::execute(
                'UPDATE invoice_products SET damaged_stock = 0, updated_at = NOW() WHERE product_id = ? AND tenant_id = ?',
                [$id, $tid]
            );

            // 2. Journal entry: Debit Loss on Damaged Goods / Credit Inventory
            if ($lossAmount > 0) {
                Database::insert(
                    'INSERT INTO invoice_journal_entries
                        (tenant_id, invoice_id, entry_date, entry_number, description, debit_account, credit_account, amount, created_at)
                     VALUES (?, NULL, ?, ?, ?, "Loss on Damaged Goods", "Inventory", ?, NOW())',
                    [
                        $tid, $entryDate,
                        'WO-' . $id . '-' . date('Ymd'),
                        "Write-off: {$prod['name']} (SKU {$prod['sku']}) × {$damagedQty} units",
                        $lossAmount,
                    ]
                );

                // 3. Expense entry for inventory loss
                Database::insert(
                    'INSERT INTO marketplace_expenses
                        (tenant_id, invoice_id, category, description, amount, expense_date, marketplace, created_at)
                     VALUES (?, NULL, "Inventory Loss", ?, ?, ?, "none", NOW())',
                    [
                        $tid,
                        "Damaged goods write-off: {$prod['name']} × {$damagedQty}",
                        $lossAmount,
                        $entryDate,
                    ]
                );
            }

            // 4. Audit log
            Database::insert(
                'INSERT INTO audit_log (tenant_id, user_id, action, table_name, record_id, new_value, ip_address, created_at)
                 VALUES (?, ?, "damaged_stock_write_off", "invoice_products", ?, ?, ?, NOW())',
                [
                    $tid, $userId, $id,
                    json_encode(['sku' => $prod['sku'], 'qty' => $damagedQty, 'loss_amount' => $lossAmount]),
                    $request->ip() ?? null,
                ]
            );

            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Write-off failed: ' . $e->getMessage(), 500);
        }

        Response::success([
            'product_id'    => $id,
            'sku'           => $prod['sku'],
            'written_off_qty' => $damagedQty,
            'loss_amount'   => $lossAmount,
        ], 'Damaged stock written off');
    }
}
