<?php
declare(strict_types=1);

/**
 * Admin Marketplace Analytics Controller
 * GET  /admin/marketplace-analytics/analytics        — per-platform analytics
 * GET  /admin/marketplace-analytics/settlements      — list settlements
 * POST /admin/marketplace-analytics/settlements      — create settlement
 * GET  /admin/marketplace-analytics/{platform}/summary — single platform
 */
class AdminMarketplaceAnalyticsController
{
    public function analytics(Request $request): void
    {
        $tid  = Database::tenantId();
        // Default to last 12 months so data is always visible without explicit date filter
        $from = $request->query('from_date') ?: date('Y-m-d', strtotime('-12 months'));
        $to   = $request->query('to_date')   ?: date('Y-m-d');

        $rows = Database::fetchAll(
            'SELECT marketplace,
                    COALESCE(SUM(total_amount), 0)      AS revenue,
                    COUNT(*)                             AS orders,
                    COALESCE(SUM(commission_amount), 0) AS commission,
                    COALESCE(SUM(CASE WHEN status = "returned" THEN 1 ELSE 0 END), 0) AS returns
             FROM marketplace_sales_orders
             WHERE tenant_id = ? AND order_date BETWEEN ? AND ?
             GROUP BY marketplace',
            [$tid, $from, $to]
        );

        $totalRevenue     = 0.0;
        $totalCommission  = 0.0;
        $totalReturns     = 0;
        $platforms        = [];

        foreach ($rows as $r) {
            $rev   = (float)$r['revenue'];
            $comm  = (float)$r['commission'];
            $commPct = $rev > 0 ? round(($comm / $rev) * 100, 2) : 0;
            $totalRevenue    += $rev;
            $totalCommission += $comm;
            $totalReturns    += (int)$r['returns'];
            $platforms[] = [
                'marketplace'      => $r['marketplace'],
                'revenue'          => $rev,
                'orders'           => (int)$r['orders'],
                'commission'       => $comm,
                'commission_pct'   => $commPct,
                'returns'          => (int)$r['returns'],
                'top_product'      => '—',
            ];
        }

        Response::success([
            'from' => $from, 'to' => $to,
            'platforms'         => $platforms,
            'total_revenue'     => $totalRevenue,
            'total_commission'  => $totalCommission,
            'total_returns'     => $totalReturns,
        ]);
    }

    public function settlements(Request $request): void
    {
        $page   = max(1, (int)$request->query('page', 1));
        $limit  = min(500, max(1, (int)$request->query('limit', 20)));
        $tid    = Database::tenantId();
        $where  = ['tenant_id = ?'];
        $params = [$tid];

        if ($mp = $request->query('marketplace')) {
            if (in_array($mp, ['amazon','flipkart','meesho'], true)) {
                $where[] = 'marketplace = ?'; $params[] = $mp;
            }
        }
        $wc     = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM marketplace_settlements WHERE $wc", $params);
        $offset = ($page - 1) * $limit;
        $rows   = Database::fetchAll(
            "SELECT * FROM marketplace_settlements WHERE $wc ORDER BY period_start DESC LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );
        foreach ($rows as &$r) {
            foreach (['gross_sales','returns_refunds','marketplace_commission','tds_deducted','payment_received','expected_amount','difference'] as $f) {
                $r[$f] = (float)$r[$f];
            }
        }
        Response::paginated($rows, [
            'page' => $page, 'limit' => $limit, 'total' => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }

    public function storeSettlement(Request $request): void
    {
        $tid        = Database::tenantId();
        $mp         = $request->input('marketplace');
        $periodStart = $request->input('period_start');
        $periodEnd   = $request->input('period_end');
        $grossSales  = $request->input('gross_sales');

        if (!in_array($mp, ['amazon','flipkart','meesho'], true) || !$periodStart || !$periodEnd || !is_numeric($grossSales)) {
            Response::error('marketplace, period_start, period_end, and gross_sales are required', 422);
        }

        $id = Database::insert(
            'INSERT INTO marketplace_settlements
                (tenant_id, marketplace, external_id, period_start, period_end,
                 gross_sales, returns_refunds, marketplace_commission, tds_deducted,
                 payment_received, expected_amount, difference, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [
                $tid, $mp,
                $request->input('external_id') ?: null,
                $periodStart, $periodEnd,
                (float)$grossSales,
                (float)($request->input('returns_refunds') ?? 0),
                (float)($request->input('marketplace_commission') ?? 0),
                (float)($request->input('tds_deducted') ?? 0),
                (float)($request->input('payment_received') ?? 0),
                (float)($request->input('expected_amount') ?? 0),
                (float)($request->input('difference') ?? 0),
                in_array($request->input('status'), ['pending','received','disputed'], true) ? $request->input('status') : 'pending',
            ]
        );
        $row = Database::fetch('SELECT * FROM marketplace_settlements WHERE settlement_id = ? AND tenant_id = ?', [$id, $tid]);
        Response::success($row, 'Settlement created', 201);
    }

    public function platformSummary(Request $request): void
    {
        $platform = $request->param('platform');
        $tid      = Database::tenantId();
        if (!in_array($platform, ['amazon','flipkart','meesho','other'], true)) {
            Response::error('Invalid platform', 400);
        }
        $row = Database::fetch(
            'SELECT COALESCE(SUM(total_amount), 0) AS revenue,
                    COUNT(*) AS orders,
                    COALESCE(SUM(commission_amount), 0) AS commission
             FROM marketplace_sales_orders
             WHERE tenant_id = ? AND marketplace = ?',
            [$tid, $platform]
        );
        Response::success([
            'marketplace' => $platform,
            'revenue'     => (float)($row['revenue'] ?? 0),
            'orders'      => (int)($row['orders'] ?? 0),
            'commission'  => (float)($row['commission'] ?? 0),
        ]);
    }
}
