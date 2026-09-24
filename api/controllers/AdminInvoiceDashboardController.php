<?php
declare(strict_types=1);

/**
 * Admin Invoice Dashboard Controller
 * GET /admin/invoice-dashboard/summary        — KPI cards
 * GET /admin/invoice-dashboard/revenue-chart  — monthly revenue/profit
 * GET /admin/invoice-dashboard/recent-activity — last 10 audit actions
 */
class AdminInvoiceDashboardController
{
    public function summary(Request $request): void
    {
        $tid   = Database::tenantId();
        $today = date('Y-m-d');
        $monthStart = date('Y-m-01');

        $todaySales = (float)(Database::fetch(
            'SELECT COALESCE(SUM(total_amount), 0) AS total FROM scan_invoices
             WHERE tenant_id = ? AND DATE(invoice_date) = ? AND processing_status = "approved" AND invoice_type = "sale"',
            [$tid, $today]
        )['total'] ?? 0);

        $monthlyRevenue = (float)(Database::fetch(
            'SELECT COALESCE(SUM(total_amount), 0) AS total FROM scan_invoices
             WHERE tenant_id = ? AND invoice_date >= ? AND processing_status = "approved" AND invoice_type = "sale"',
            [$tid, $monthStart]
        )['total'] ?? 0);

        $netProfit = (float)(Database::fetch(
            'SELECT COALESCE(SUM(total_amount - tax_amount), 0) AS total FROM scan_invoices
             WHERE tenant_id = ? AND invoice_date >= ? AND processing_status = "approved" AND invoice_type = "sale"',
            [$tid, $monthStart]
        )['total'] ?? 0);

        $gstPayable = (float)(Database::fetch(
            'SELECT COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) AS total
             FROM gst_records WHERE tenant_id = ? AND MONTH(transaction_date) = MONTH(NOW()) AND YEAR(transaction_date) = YEAR(NOW())',
            [$tid]
        )['total'] ?? 0);

        $totalProducts = (int)(Database::fetch(
            'SELECT COUNT(*) AS cnt FROM invoice_products WHERE tenant_id = ? AND is_active = 1', [$tid]
        )['cnt'] ?? 0);
        $lowStockCount = (int)(Database::fetch(
            'SELECT COUNT(*) AS cnt FROM invoice_products WHERE tenant_id = ? AND is_active = 1 AND current_stock > 0 AND current_stock <= min_stock_level', [$tid]
        )['cnt'] ?? 0);
        $outOfStockCount = (int)(Database::fetch(
            'SELECT COUNT(*) AS cnt FROM invoice_products WHERE tenant_id = ? AND is_active = 1 AND current_stock <= 0', [$tid]
        )['cnt'] ?? 0);
        $unreadNotifs = (int)(Database::fetch(
            'SELECT COUNT(*) AS cnt FROM invoice_notifications WHERE tenant_id = ? AND is_read = 0', [$tid]
        )['cnt'] ?? 0);

        $recentInvoices = Database::fetchAll(
            'SELECT invoice_id, invoice_number, original_filename, marketplace, total_amount, processing_status, created_at
             FROM scan_invoices WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5',
            [$tid]
        );
        foreach ($recentInvoices as &$r) { $r['total_amount'] = (float)$r['total_amount']; }

        Response::success([
            'today_sales'       => $todaySales,
            'monthly_revenue'   => $monthlyRevenue,
            'net_profit'        => $netProfit,
            'gst_payable'       => $gstPayable,
            'total_products'    => $totalProducts,
            'low_stock_count'   => $lowStockCount,
            'out_of_stock_count'=> $outOfStockCount,
            'unread_notifications' => $unreadNotifs,
            'recent_invoices'   => $recentInvoices,
        ]);
    }

    public function revenueChart(Request $request): void
    {
        $tid  = Database::tenantId();
        $year = (int)($request->query('year') ?: date('Y'));

        $rows = Database::fetchAll(
            "SELECT DATE_FORMAT(invoice_date, '%b') AS month_label,
                    MONTH(invoice_date) AS month_num,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COALESCE(SUM(total_amount - tax_amount), 0) AS net_rev
             FROM scan_invoices
             WHERE tenant_id = ? AND YEAR(invoice_date) = ?
               AND processing_status = 'approved' AND invoice_type = 'sale'
             GROUP BY MONTH(invoice_date), DATE_FORMAT(invoice_date, '%b')
             ORDER BY MONTH(invoice_date)",
            [$tid, $year]
        );

        // Get monthly expenses to subtract from net_revenue for real profit
        $expenseRows = Database::fetchAll(
            "SELECT MONTH(expense_date) AS month_num,
                    COALESCE(SUM(amount), 0) AS total_expenses
             FROM marketplace_expenses
             WHERE tenant_id = ? AND YEAR(expense_date) = ?
             GROUP BY MONTH(expense_date)",
            [$tid, $year]
        );
        $expensesByMonth = [];
        foreach ($expenseRows as $e) {
            $expensesByMonth[(int)$e['month_num']] = (float)$e['total_expenses'];
        }

        $labels  = [];
        $revenue = [];
        $profit  = [];
        foreach ($rows as $r) {
            $labels[]  = $r['month_label'];
            $rev       = (float)$r['revenue'];
            $netRev    = (float)$r['net_rev'];
            $expenses  = $expensesByMonth[(int)$r['month_num']] ?? 0;
            $revenue[] = $rev;
            // Profit = net revenue (after shipping/commission) minus other expenses
            $profit[]  = max(0, round($netRev - $expenses, 2));
        }

        Response::success([
            'year'     => $year,
            'labels'   => $labels,
            'datasets' => [
                ['name' => 'Revenue', 'data' => $revenue],
                ['name' => 'Profit',  'data' => $profit],
            ],
        ]);
    }

    public function recentActivity(Request $request): void
    {
        $tid  = Database::tenantId();
        $rows = Database::fetchAll(
            "SELECT al.id AS log_id, al.action, al.table_name, al.record_id, al.created_at,
                    u.name AS user_name
             FROM audit_log al
             LEFT JOIN users u ON u.user_id = al.user_id AND u.tenant_id = al.tenant_id
             WHERE al.tenant_id = ?
             ORDER BY al.created_at DESC LIMIT 10",
            [$tid]
        );
        Response::success($rows);
    }
}
