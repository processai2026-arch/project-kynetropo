<?php
declare(strict_types=1);

/**
 * Admin Marketplace Sales Controller (read-only)
 * GET /admin/marketplace-sales/summary       — KPIs by period
 * GET /admin/marketplace-sales/by-marketplace — per-platform totals
 * GET /admin/marketplace-sales                — paginated list
 * GET /admin/marketplace-sales/{id}           — single order
 */
class AdminMarketplaceSalesController
{
    public function summary(Request $request): void
    {
        $tid    = Database::tenantId();
        $period = $request->query('period') ?: 'month';
        $from   = match ($period) {
            'today' => date('Y-m-d'),
            'week'  => date('Y-m-d', strtotime('monday this week')),
            'year'  => date('Y-01-01'),
            'month' => date('Y-m-01'),
            default => date('Y-m-d', strtotime('-12 months')), // "all" or unknown → last 12 months
        };
        // For month period, if no data this month fall back to last 12 months
        if ($period === 'month') {
            $check = Database::fetch(
                'SELECT COUNT(*) AS cnt FROM marketplace_sales_orders WHERE tenant_id = ? AND order_date >= ?',
                [$tid, $from]
            );
            if ((int)($check['cnt'] ?? 0) === 0) {
                $from = date('Y-m-d', strtotime('-12 months'));
            }
        }
        $to = date('Y-m-d');

        $stats = Database::fetch(
            'SELECT COALESCE(SUM(total_amount), 0) AS revenue,
                    COUNT(*) AS orders,
                    COALESCE(SUM(CASE WHEN status = "returned" THEN 1 ELSE 0 END), 0) AS returns
             FROM marketplace_sales_orders
             WHERE tenant_id = ? AND order_date BETWEEN ? AND ?',
            [$tid, $from, $to]
        );
        $revenue = (float)$stats['revenue'];
        $orders  = (int)$stats['orders'];

        $byMp = Database::fetchAll(
            'SELECT marketplace,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COUNT(*) AS orders,
                    COALESCE(SUM(commission_amount), 0) AS commission
             FROM marketplace_sales_orders
             WHERE tenant_id = ? AND order_date BETWEEN ? AND ?
             GROUP BY marketplace',
            [$tid, $from, $to]
        );
        foreach ($byMp as &$m) {
            $m['revenue']    = (float)$m['revenue'];
            $m['commission'] = (float)$m['commission'];
        }

        Response::success([
            'period'          => $period,
            'from'            => $from,
            'to'              => $to,
            'revenue'         => $revenue,
            'orders'          => $orders,
            'returns'         => (int)$stats['returns'],
            'avg_order_value' => $orders > 0 ? round($revenue / $orders, 2) : 0,
            'by_marketplace'  => $byMp,
        ]);
    }

    public function byMarketplace(Request $request): void
    {
        $tid  = Database::tenantId();
        $rows = Database::fetchAll(
            'SELECT marketplace,
                    COALESCE(SUM(total_amount), 0) AS revenue,
                    COUNT(*) AS orders,
                    COALESCE(SUM(commission_amount), 0) AS commission
             FROM marketplace_sales_orders
             WHERE tenant_id = ?
             GROUP BY marketplace
             ORDER BY revenue DESC',
            [$tid]
        );
        foreach ($rows as &$r) {
            $r['revenue']    = (float)$r['revenue'];
            $r['commission'] = (float)$r['commission'];
        }
        Response::success($rows);
    }

    public function index(Request $request): void
    {
        $page   = max(1, (int)$request->query('page', 1));
        $limit  = min(500, max(1, (int)$request->query('limit', 20)));
        $tid    = Database::tenantId();
        $where  = ['so.tenant_id = ?'];
        $params = [$tid];

        if ($from = $request->query('from_date')) { $where[] = 'so.order_date >= ?'; $params[] = $from; }
        if ($to   = $request->query('to_date'))   { $where[] = 'so.order_date <= ?'; $params[] = $to; }
        if ($mp   = $request->query('marketplace')) {
            if (in_array($mp, ['amazon','flipkart','meesho','other'], true)) {
                $where[] = 'so.marketplace = ?'; $params[] = $mp;
            }
        }
        if ($status = $request->query('status')) {
            if (in_array($status, ['completed','pending','cancelled','returned'], true)) {
                $where[] = 'so.status = ?'; $params[] = $status;
            }
        }

        $wc     = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM marketplace_sales_orders so WHERE $wc", $params);
        $offset = ($page - 1) * $limit;
        $rows   = Database::fetchAll(
            "SELECT so.*,
                    c.name AS customer_name, c.gstin AS customer_gstin,
                    si.invoice_number
             FROM marketplace_sales_orders so
             LEFT JOIN invoice_customers c ON c.customer_id = so.customer_id AND c.tenant_id = so.tenant_id
             LEFT JOIN scan_invoices si ON si.invoice_id = so.invoice_id AND si.tenant_id = so.tenant_id
             WHERE $wc
             ORDER BY so.order_date DESC, so.order_id DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );
        foreach ($rows as &$r) {
            $r['total_amount']     = (float)$r['total_amount'];
            $r['net_revenue']      = (float)$r['net_revenue'];
            $r['commission_amount']= (float)$r['commission_amount'];
        }
        Response::paginated($rows, [
            'page' => $page, 'limit' => $limit, 'total' => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }

    public function show(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        if ($id <= 0) Response::error('Invalid ID', 400);
        $row = Database::fetch(
            'SELECT so.*,
                    c.name AS customer_name, c.gstin AS customer_gstin,
                    si.invoice_number, si.vendor_name
             FROM marketplace_sales_orders so
             LEFT JOIN invoice_customers c ON c.customer_id = so.customer_id AND c.tenant_id = so.tenant_id
             LEFT JOIN scan_invoices si ON si.invoice_id = so.invoice_id AND si.tenant_id = so.tenant_id
             WHERE so.order_id = ? AND so.tenant_id = ? LIMIT 1',
            [$id, $tid]
        );
        if (!$row) Response::error('Sales order not found', 404);
        foreach (['total_amount','net_revenue','subtotal','tax_amount','shipping_charges','commission_amount','discount'] as $f) {
            if (isset($row[$f])) $row[$f] = (float)$row[$f];
        }
        Response::success($row);
    }
}
