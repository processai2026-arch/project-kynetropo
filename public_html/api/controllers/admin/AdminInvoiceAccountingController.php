<?php
declare(strict_types=1);

/**
 * Admin Invoice Accounting Controller
 * GET /admin/invoice-accounting/journal-entries — paginated entries
 * GET /admin/invoice-accounting/profit-loss     — P&L statement
 * GET /admin/invoice-accounting/balance-sheet   — stub
 * GET /admin/invoice-accounting/accounts        — chart of accounts
 */
class AdminInvoiceAccountingController
{
    public function journalEntries(Request $request): void
    {
        $page   = max(1, (int)$request->query('page', 1));
        $limit  = min(500, max(1, (int)$request->query('limit', 20)));
        $tid    = Database::tenantId();
        $where  = ['je.tenant_id = ?'];
        $params = [$tid];

        if ($from = $request->query('from_date')) { $where[] = 'je.entry_date >= ?'; $params[] = $from; }
        if ($to   = $request->query('to_date'))   { $where[] = 'je.entry_date <= ?'; $params[] = $to; }
        if ($acct = $request->query('account'))   {
            $like    = '%' . trim($acct) . '%';
            $where[] = '(je.debit_account LIKE ? OR je.credit_account LIKE ?)';
            $params[] = $like; $params[] = $like;
        }

        $wc     = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM invoice_journal_entries je WHERE $wc", $params);
        $offset = ($page - 1) * $limit;
        $rows   = Database::fetchAll(
            "SELECT je.*, si.invoice_number
             FROM invoice_journal_entries je
             LEFT JOIN scan_invoices si ON si.invoice_id = je.invoice_id AND si.tenant_id = je.tenant_id
             WHERE $wc ORDER BY je.entry_date DESC LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );
        foreach ($rows as &$r) { $r['amount'] = (float)$r['amount']; }
        Response::paginated($rows, [
            'page' => $page, 'limit' => $limit, 'total' => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }

    public function profitLoss(Request $request): void
    {
        $tid  = Database::tenantId();
        $from = $request->query('from_date') ?: date('Y-m-01');
        $to   = $request->query('to_date')   ?: date('Y-m-d');

        // Revenue from marketplace sales orders (complete picture including all approved invoices)
        $revenue = (float)(Database::fetch(
            'SELECT COALESCE(SUM(total_amount), 0) AS total
             FROM marketplace_sales_orders WHERE tenant_id = ? AND order_date BETWEEN ? AND ?
             AND status != "returned"',
            [$tid, $from, $to]
        )['total'] ?? 0);

        // Real COGS: cost_price × quantity from inventory for matched products
        // Falls back to unit_price × 35% for unmatched products
        $realCogs = (float)(Database::fetch(
            'SELECT COALESCE(SUM(sil.quantity * COALESCE(ip.cost_price, sil.unit_price * 0.35)), 0) AS total
             FROM scan_invoice_line_items sil
             JOIN scan_invoices si ON si.invoice_id = sil.invoice_id
             LEFT JOIN invoice_products ip ON ip.product_id = sil.product_id AND ip.tenant_id = ?
             WHERE si.tenant_id = ? AND si.invoice_date BETWEEN ? AND ?
               AND si.processing_status = "approved" AND si.invoice_type = "sale"',
            [$tid, $tid, $from, $to]
        )['total'] ?? 0);

        // If no line items matched, fall back to 35% estimate
        $cogs        = $realCogs > 0 ? round($realCogs, 2) : round($revenue * 0.35, 2);
        $grossProfit = round($revenue - $cogs, 2);

        $shippingCost   = (float)(Database::fetch(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM marketplace_expenses
             WHERE tenant_id = ? AND expense_date BETWEEN ? AND ? AND category = 'Shipping'",
            [$tid, $from, $to]
        )['total'] ?? 0);
        $commissionCost = (float)(Database::fetch(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM marketplace_expenses
             WHERE tenant_id = ? AND expense_date BETWEEN ? AND ? AND category = 'Marketplace Commission'",
            [$tid, $from, $to]
        )['total'] ?? 0);
        $otherExpenses  = (float)(Database::fetch(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM marketplace_expenses
             WHERE tenant_id = ? AND expense_date BETWEEN ? AND ? AND category NOT IN ('Shipping', 'Marketplace Commission')",
            [$tid, $from, $to]
        )['total'] ?? 0);

        $operatingProfit = round($grossProfit - $shippingCost - $commissionCost - $otherExpenses, 2);

        $gstPayable = (float)(Database::fetch(
            'SELECT COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) AS total
             FROM gst_records WHERE tenant_id = ? AND transaction_date BETWEEN ? AND ?',
            [$tid, $from, $to]
        )['total'] ?? 0);

        $netProfit = round($operatingProfit - $gstPayable, 2);

        Response::success([
            'from' => $from, 'to' => $to,
            'revenue'           => $revenue,
            'cogs'              => $cogs,
            'gross_profit'      => $grossProfit,
            'shipping_cost'     => $shippingCost,
            'commission_cost'   => $commissionCost,
            'other_expenses'    => $otherExpenses,
            'operating_profit'  => $operatingProfit,
            'gst_payable'       => $gstPayable,
            'net_profit'        => $netProfit,
        ]);
    }

    public function balanceSheet(Request $request): void
    {
        // Stub — no balance sheet tracking implemented
        Response::success([
            'assets'      => ['cash_and_bank' => 0, 'accounts_receivable' => 0, 'inventory' => 0],
            'liabilities' => ['accounts_payable' => 0, 'gst_payable' => 0],
            'equity'      => ['retained_earnings' => 0],
        ]);
    }

    public function accounts(Request $request): void
    {
        Response::success([
            ['code' => '1000', 'name' => 'Cash & Bank',                    'type' => 'asset'],
            ['code' => '1100', 'name' => 'Accounts Receivable',            'type' => 'asset'],
            ['code' => '1200', 'name' => 'Inventory',                      'type' => 'asset'],
            ['code' => '1300', 'name' => 'Tax Receivable',                 'type' => 'asset'],
            ['code' => '2000', 'name' => 'Accounts Payable',               'type' => 'liability'],
            ['code' => '2100', 'name' => 'GST Payable',                    'type' => 'liability'],
            ['code' => '4000', 'name' => 'Sales Revenue',                  'type' => 'revenue'],
            ['code' => '5000', 'name' => 'Cost of Goods Sold',             'type' => 'expense'],
            ['code' => '5100', 'name' => 'Marketplace Commission Expense', 'type' => 'expense'],
            ['code' => '5200', 'name' => 'Shipping Expense',               'type' => 'expense'],
        ]);
    }
}
