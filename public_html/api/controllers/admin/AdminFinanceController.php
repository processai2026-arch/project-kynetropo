<?php
declare(strict_types=1);

/**
 * Admin Finance Controller — Cash-based financial summary dashboard
 *
 * IMPORTANT: This controller does NOT compute accounting Profit & Loss.
 * It derives a simple cash-in/cash-out summary from paid orders/invoices and
 * recorded expenses. There is no general ledger, no accrual accounting, no
 * depreciation, no COGS matching, and no real balance sheet behind this —
 * so figures here must never be presented as "net profit" or "P&L" in the
 * accounting sense. They are an operating cash signal only.
 *
 * Endpoints
 * ─────────
 *   GET /admin/finance/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD   — cash-based summary
 *   GET /admin/finance/ratios
 *   GET /admin/finance/config         — current balance-sheet config (tenant-entered, may be absent)
 *   PUT /admin/finance/config         — update investment/assets/liabilities
 *
 * Smart Inventory interconnections
 *   GET /admin/finance/inventory-valuation       — current stock value by zone
 *   GET /admin/finance/inventory-value-movement  — monthly stock value in/out
 *   GET /admin/finance/damaged-stock-writeoff    — DAMAGED zone write-off candidates
 */
class AdminFinanceController
{
    // ─── GET /admin/finance/pnl ──────────────────────────────────────────────
    public function pnl(Request $request): void
    {
        [$from, $to] = $this->window($request);
        Response::success($this->pnlData($from, $to));
    }

    /**
     * Assemble the cash-based financial summary for a window — shared by the
     * endpoint and the AI analyst.
     *
     * NOTE: This is cash in (paid orders/invoices) minus cash out (recorded
     * expenses) for the window. It is NOT accrual-based accounting profit —
     * there is no ledger, no COGS matching, no depreciation, no accruals.
     * Field names reflect that: `cashIn` / `cashOut` / `operatingCashSurplus`.
     */
    public function pnlData(string $from, string $to): array
    {
        // ── Revenue = paid orders within window (delivery_fee excluded) ─────
        $revenueRow = Database::fetch(
            "SELECT COALESCE(SUM(total_amount - COALESCE(delivery_fee, 0)), 0) AS revenue
             FROM orders
             WHERE tenant_id = ? AND payment_status = 'paid'
               AND DATE(created_at) BETWEEN ? AND ?",
            [Database::tenantId(), $from, $to]
        );
        // Revenue also includes paid manual invoices (order_id IS NULL so order-linked
        // invoices aren't double-counted — their revenue already comes from the order).
        $revenue = (float)($revenueRow['revenue'] ?? 0) + self::invoiceRevenue($from, $to);

        // ── Expenses = sum of expense amounts within window ─────────────────
        $expenseRow = Database::fetch(
            "SELECT COALESCE(SUM(amount), 0) AS expenses
             FROM expenses
             WHERE tenant_id = ? AND expense_date BETWEEN ? AND ?",
            [Database::tenantId(), $from, $to]
        );
        $expenses = (float)($expenseRow['expenses'] ?? 0);

        // ── Monthly breakdown (revenue/expenses by YYYY-MM) ─────────────────
        $revByMonth = Database::fetchAll(
            "SELECT DATE_FORMAT(created_at, '%Y-%m') AS m,
                    COALESCE(SUM(total_amount - COALESCE(delivery_fee, 0)), 0) AS v
             FROM orders
             WHERE tenant_id = ? AND payment_status = 'paid'
               AND DATE(created_at) BETWEEN ? AND ?
             GROUP BY m ORDER BY m ASC",
            [Database::tenantId(), $from, $to]
        );
        $invRevByMonth = Database::fetchAll(
            "SELECT DATE_FORMAT(created_at, '%Y-%m') AS m,
                    COALESCE(SUM(total), 0) AS v
             FROM invoices
             WHERE payment_status = 'paid' AND order_id IS NULL
               AND tenant_id = ?
               AND DATE(created_at) BETWEEN ? AND ?
             GROUP BY m ORDER BY m ASC",
            [Database::tenantId(), $from, $to]
        );
        $expByMonth = Database::fetchAll(
            "SELECT DATE_FORMAT(expense_date, '%Y-%m') AS m,
                    COALESCE(SUM(amount), 0) AS v
             FROM expenses
             WHERE tenant_id = ? AND expense_date BETWEEN ? AND ?
             GROUP BY m ORDER BY m ASC",
            [Database::tenantId(), $from, $to]
        );

        // Merge months into a single ordered series
        $months = [];
        foreach ($revByMonth as $r)    { $months[$r['m']]['revenue']  = (float)$r['v']; }
        foreach ($invRevByMonth as $r) { $months[$r['m']]['revenue']  = ($months[$r['m']]['revenue'] ?? 0) + (float)$r['v']; }
        foreach ($expByMonth as $r)    { $months[$r['m']]['expenses'] = (float)$r['v']; }
        ksort($months);

        $monthly = [];
        foreach ($months as $m => $vals) {
            $rev = (float)($vals['revenue']  ?? 0);
            $exp = (float)($vals['expenses'] ?? 0);
            $monthly[] = [
                'month'              => $m,
                'cashIn'             => $rev,
                'cashOut'            => $exp,
                'operatingCashSurplus' => $rev - $exp,
            ];
        }

        // ── Expense breakdown by category ───────────────────────────────────
        $expBreakdown = Database::fetchAll(
            "SELECT category, COALESCE(SUM(amount), 0) AS amount
             FROM expenses
             WHERE tenant_id = ? AND expense_date BETWEEN ? AND ?
             GROUP BY category
             ORDER BY amount DESC",
            [Database::tenantId(), $from, $to]
        );
        foreach ($expBreakdown as &$e) { $e['amount'] = (float)$e['amount']; }

        // ── Revenue breakdown by customer type ──────────────────────────────
        $revBreakdown = Database::fetchAll(
            "SELECT CASE u.user_type
                        WHEN 'dealer'   THEN 'Dealer Network'
                        WHEN 'customer' THEN 'Direct Sales'
                        ELSE 'Other'
                    END AS source,
                    COALESCE(SUM(o.total_amount - COALESCE(o.delivery_fee, 0)), 0) AS amount
             FROM orders o
             JOIN users u ON u.user_id = o.user_id AND u.tenant_id = o.tenant_id
             WHERE o.tenant_id = ? AND o.payment_status = 'paid'
               AND DATE(o.created_at) BETWEEN ? AND ?
             GROUP BY source
             ORDER BY amount DESC",
            [Database::tenantId(), $from, $to]
        );
        foreach ($revBreakdown as &$r) { $r['amount'] = (float)$r['amount']; }
        unset($r);
        // Manual invoices (no linked order) shown as their own revenue source
        $invRev = self::invoiceRevenue($from, $to);
        if ($invRev > 0) {
            $revBreakdown[] = ['source' => 'Manual Invoices', 'amount' => round($invRev, 2)];
            usort($revBreakdown, static fn($a, $b) => $b['amount'] <=> $a['amount']);
        }

        // ── Cash-based totals ─────────────────────────────────────────────────
        // This is cash in minus cash out for the window. It is deliberately
        // NOT called "profit" or "P&L": there is no ledger behind it, so no
        // tax figure can be honestly derived from it either (removed — a
        // fabricated tax-on-cash-surplus number would mislead the tenant).
        $operatingCashSurplus = $revenue - $expenses;

        return [
            'periodFrom'           => $from,
            'periodTo'             => $to,
            'label'                => 'Cash-based summary (not accounting P&L)',
            'cashIn'               => round($revenue, 2),
            'cashOut'              => round($expenses, 2),
            'operatingCashSurplus' => round($operatingCashSurplus, 2),
            'monthly'              => $monthly,
            'expenseBreakdown'     => $expBreakdown,
            'revenueBreakdown'     => $revBreakdown,
        ];
    }

    // ─── GET /admin/finance/ratios ───────────────────────────────────────────
    public function ratios(Request $request): void
    {
        [$from, $to] = $this->window($request);
        Response::success($this->ratiosData($from, $to));
    }

    /**
     * Assemble the financial ratios for a window — shared by the endpoint and the AI analyst.
     *
     * NOTE: `investment`, `currentAssets`, `currentLiabilities` are tenant-entered
     * balance-sheet inputs (via PUT /admin/finance/config). When a tenant has not
     * entered them, we now return null instead of silently substituting hard-coded
     * placeholder figures — any ratio that depends on a missing input is also null
     * rather than a fabricated number. There is also no real tax figure (no ledger),
     * so "profit"-based ratios are computed from the cash surplus and labelled as such.
     */
    public function ratiosData(string $from, string $to): array
    {
        $revenue = (float)(Database::fetch(
            "SELECT COALESCE(SUM(total_amount - COALESCE(delivery_fee, 0)), 0) AS v
             FROM orders WHERE tenant_id = ? AND payment_status = 'paid' AND DATE(created_at) BETWEEN ? AND ?",
            [Database::tenantId(), $from, $to]
        )['v'] ?? 0) + self::invoiceRevenue($from, $to);

        $expenses = (float)(Database::fetch(
            "SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE tenant_id = ? AND expense_date BETWEEN ? AND ?",
            [Database::tenantId(), $from, $to]
        )['v'] ?? 0);

        $investment         = self::configValueOrNull('investment');
        $currentAssets      = self::configValueOrNull('current_assets');
        $currentLiabilities = self::configValueOrNull('current_liabilities');

        $operatingCashSurplus = $revenue - $expenses;

        $safeDiv = static fn(float $a, float $b): float => $b == 0.0 ? 0.0 : $a / $b;

        return [
            'cashSurplusMargin'  => round($safeDiv($operatingCashSurplus, $revenue), 4),
            'expenseRatio'       => round($safeDiv($expenses, $revenue), 4),
            'roi'                => $investment !== null ? round($safeDiv($operatingCashSurplus, $investment), 4) : null,
            'currentRatio'       => ($currentAssets !== null && $currentLiabilities !== null)
                ? round($safeDiv($currentAssets, $currentLiabilities), 4)
                : null,
            'currentAssets'      => $currentAssets,
            'currentLiabilities' => $currentLiabilities,
            'investment'         => $investment,
        ];
    }

    // ─── Shared date-window parser ───────────────────────────────────────────
    private function window(Request $request): array
    {
        $to   = $request->query('to')   ?: date('Y-m-d');
        $from = $request->query('from') ?: date('Y-m-d', strtotime('-6 months', strtotime($to)));
        self::validateDate($from, 'from');
        self::validateDate($to, 'to');
        if ($from > $to) {
            Response::error('`from` must be earlier than or equal to `to`', 422);
        }
        return [$from, $to];
    }

    // ─── POST /admin/finance/ai-analysis — AI Financial Analyst ──────────────
    // Reuses the EXACT pnl + ratios figures (single source of truth) and asks the
    // LLM for a plain-language health read, drivers, risks, recommendations & outlook.
    public function aiAnalysis(Request $request): void
    {
        [$from, $to] = $this->window($request);
        $pnl    = $this->pnlData($from, $to);
        $ratios = $this->ratiosData($from, $to);

        // Compact, aggregated figures only (no raw transactions) — and the period delta.
        $monthly = $pnl['monthly'] ?? [];
        $prev = count($monthly) >= 2 ? $monthly[count($monthly) - 2] : null;
        $last = count($monthly) >= 1 ? $monthly[count($monthly) - 1] : null;

        $facts = [
            'period'                   => ['from' => $from, 'to' => $to],
            'currency'                 => 'INR',
            'basis'                    => 'cash (paid orders/invoices minus recorded expenses) — not accrual accounting P&L',
            'cash_in'                  => $pnl['cashIn'],
            'cash_out'                 => $pnl['cashOut'],
            'operating_cash_surplus'   => $pnl['operatingCashSurplus'],
            'cash_surplus_margin_pct'  => round(($ratios['cashSurplusMargin'] ?? 0) * 100, 1),
            'expense_ratio_pct'        => round(($ratios['expenseRatio'] ?? 0) * 100, 1),
            'monthly_trend'            => array_map(fn($m) => [
                'month' => $m['month'], 'cash_in' => $m['cashIn'], 'cash_out' => $m['cashOut'], 'operating_cash_surplus' => $m['operatingCashSurplus'],
            ], $monthly),
            'last_vs_prev_month' => ($prev && $last) ? [
                'revenue_change_pct' => $prev['cashIn'] > 0 ? round(($last['cashIn'] - $prev['cashIn']) / $prev['cashIn'] * 100, 1) : null,
                'expense_change_pct' => $prev['cashOut'] > 0 ? round(($last['cashOut'] - $prev['cashOut']) / $prev['cashOut'] * 100, 1) : null,
            ] : null,
            'top_expense_categories' => array_slice($pnl['expenseBreakdown'] ?? [], 0, 6),
            'revenue_by_source'      => $pnl['revenueBreakdown'] ?? [],
        ];

        $companyRow = Database::fetch(
            "SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = 'company_name' LIMIT 1",
            [Database::tenantId()]
        );
        $companyName = !empty($companyRow['setting_value']) ? $companyRow['setting_value'] : 'this company';

        $system = "You are a CFO-grade financial analyst for {$companyName}, an Indian company. "
            . 'You are given AGGREGATED cash-based figures for a period (INR) — cash in from paid '
            . 'orders/invoices minus cash out from recorded expenses. This is NOT accrual accounting '
            . 'profit (no ledger, no tax computation, no COGS matching) — speak in terms of cash flow, '
            . 'not "net profit" or "tax". Analyse them and '
            . 'reply with STRICT JSON only, no markdown, in this exact shape: '
            . '{"health_score": <0-100 integer>, "headline": "<one sentence>", '
            . '"summary": "<2-4 sentence plain-language read of the period>", '
            . '"drivers": ["<what is moving revenue/cost/profit>", ...], '
            . '"risks": ["<concrete financial risk with the number>", ...], '
            . '"recommendations": ["<specific, actionable step>", ...], '
            . '"outlook": "<one-line forward view based on the trend>"}. '
            . 'Be specific and cite the actual figures (₹). 3-5 items per list. No generic filler.';

        try {
            $resp = GroqAPI::chat([
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => 'Analyse this period:\n' . json_encode($facts, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)],
            ], 'llama-3.3-70b-versatile', 0.5);
            $ai = GroqAPI::extractJSON($resp);
        } catch (\Throwable $e) {
            error_log('Finance AI analysis failed: ' . $e->getMessage());
            Response::error('AI analysis is unavailable right now. Please try again shortly.', 502);
        }

        $clean = static fn($v) => array_values(array_filter(array_map(
            fn($x) => is_string($x) ? trim($x) : '',
            is_array($v ?? null) ? $v : []
        ), fn($x) => $x !== ''));

        Response::success([
            'period'          => ['from' => $from, 'to' => $to],
            'health_score'    => max(0, min(100, (int)($ai['health_score'] ?? 0))),
            'headline'        => is_string($ai['headline'] ?? null) ? trim($ai['headline']) : '',
            'summary'         => is_string($ai['summary'] ?? null) ? trim($ai['summary']) : '',
            'drivers'         => $clean($ai['drivers'] ?? []),
            'risks'           => $clean($ai['risks'] ?? []),
            'recommendations' => $clean($ai['recommendations'] ?? []),
            'outlook'         => is_string($ai['outlook'] ?? null) ? trim($ai['outlook']) : '',
            'figures'         => $facts,
            'generated_at'    => date('Y-m-d H:i:s'),
        ], 'Financial analysis generated');
    }

    /** Revenue from paid manual invoices (no linked order) within a date window.
     *  Uses the full invoice total. Order-linked invoices are excluded here so
     *  their revenue isn't counted twice (it already comes through the order). */
    private static function invoiceRevenue(string $from, string $to): float
    {
        return (float)(Database::fetch(
            "SELECT COALESCE(SUM(total), 0) AS v
             FROM invoices
             WHERE payment_status = 'paid' AND order_id IS NULL
               AND tenant_id = ?
               AND DATE(created_at) BETWEEN ? AND ?",
            [Database::tenantId(), $from, $to]
        )['v'] ?? 0);
    }

    // ─── GET /admin/finance/config ───────────────────────────────────────────
    public function config(Request $request): void
    {
        $rows = Database::fetchAll('SELECT config_key, config_value, notes FROM finance_config WHERE tenant_id = ?', [Database::tenantId()]);
        $out  = [];
        foreach ($rows as $r) {
            $out[$r['config_key']] = [
                'value' => (float)$r['config_value'],
                'notes' => $r['notes'],
            ];
        }
        Response::success($out);
    }

    // ─── PUT /admin/finance/config ───────────────────────────────────────────
    public function updateConfig(Request $request): void
    {
        $allowed = ['investment', 'current_assets', 'current_liabilities', 'tax_rate', 'opex_tax_portion'];
        $payload = [];
        foreach ($allowed as $key) {
            $val = $request->input($key);
            if ($val === null || $val === '') continue;
            if (!is_numeric($val)) {
                Response::error("$key must be numeric", 422);
            }
            if ((float)$val < 0) {
                Response::error("$key cannot be negative", 422);
            }
            $payload[$key] = (float)$val;
        }

        if (empty($payload)) {
            Response::error('Provide at least one config value to update', 400);
        }

        foreach ($payload as $k => $v) {
            Database::execute(
                'INSERT INTO finance_config (tenant_id, config_key, config_value) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)',
                [Database::tenantId(), $k, $v]
            );
        }

        Response::success($payload, 'Finance config updated successfully');
    }

    // ─── GET /admin/finance/inventory-valuation ──────────────────────────────
    // Smart Inventory interconnection — current stock value (current_quantity x
    // standard_cost) grouped by zone.
    public function inventoryValuation(Request $request): void
    {
        $rows = Database::fetchAll(
            "SELECT z.zone_id, z.zone_name, z.zone_code, z.zone_type,
                    COALESCE(SUM(s.current_quantity * p.standard_cost), 0) AS stock_value,
                    COALESCE(SUM(s.current_quantity), 0) AS total_quantity
             FROM inventory_stock s
             JOIN inventory_zones z ON z.zone_id = s.zone_id AND z.tenant_id = s.tenant_id
             JOIN inventory_products p ON p.inv_product_id = s.inv_product_id AND p.tenant_id = s.tenant_id
             WHERE p.is_deleted = 0 AND s.tenant_id = ?
             GROUP BY z.zone_id, z.zone_name, z.zone_code, z.zone_type
             ORDER BY stock_value DESC",
            [Database::tenantId()]
        );
        foreach ($rows as &$r) {
            $r['stock_value']    = round((float)$r['stock_value'], 2);
            $r['total_quantity'] = (float)$r['total_quantity'];
        }
        unset($r);

        $total = array_sum(array_column($rows, 'stock_value'));

        Response::success([
            'total_value' => round($total, 2),
            'by_zone'     => $rows,
        ]);
    }

    // ─── GET /admin/finance/inventory-value-movement ─────────────────────────
    // Smart Inventory interconnection — monthly stock value in vs out from
    // inventory_stock_movements.
    public function inventoryValueMovement(Request $request): void
    {
        $to   = $request->query('to')   ?: date('Y-m-d');
        $from = $request->query('from') ?: date('Y-m-d', strtotime('-6 months', strtotime($to)));

        self::validateDate($from, 'from');
        self::validateDate($to, 'to');
        if ($from > $to) {
            Response::error('`from` must be earlier than or equal to `to`', 422);
        }

        $rows = Database::fetchAll(
            "SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
                    movement_type,
                    COALESCE(SUM(total_value), 0) AS value
             FROM inventory_stock_movements
             WHERE tenant_id = ? AND DATE(created_at) BETWEEN ? AND ?
             GROUP BY month, movement_type
             ORDER BY month ASC",
            [Database::tenantId(), $from, $to]
        );

        $inflowTypes  = ['STOCK_IN', 'RETURN'];
        $outflowTypes = ['STOCK_OUT', 'EMPLOYEE_ISSUE', 'DEALER_ALLOCATION', 'PRODUCTION_USE', 'DAMAGE', 'EMERGENCY_USE'];

        $months = [];
        foreach ($rows as $r) {
            $m = $r['month'];
            $months[$m]['month']       = $m;
            $months[$m]['value_in']    = $months[$m]['value_in']    ?? 0.0;
            $months[$m]['value_out']   = $months[$m]['value_out']   ?? 0.0;
            $value = (float)$r['value'];
            if (in_array($r['movement_type'], $inflowTypes, true)) {
                $months[$m]['value_in']  += $value;
            } elseif (in_array($r['movement_type'], $outflowTypes, true)) {
                $months[$m]['value_out'] += $value;
            }
        }
        ksort($months);

        $result = [];
        foreach ($months as $m) {
            $result[] = [
                'month'     => $m['month'],
                'value_in'  => round($m['value_in'], 2),
                'value_out' => round($m['value_out'], 2),
                'net_change'=> round($m['value_in'] - $m['value_out'], 2),
            ];
        }

        Response::success([
            'periodFrom' => $from,
            'periodTo'   => $to,
            'monthly'    => $result,
        ]);
    }

    // ─── GET /admin/finance/damaged-stock-writeoff ───────────────────────────
    // Smart Inventory interconnection — value of stock currently sitting in
    // DAMAGED zones (write-off candidates).
    public function damagedStockWriteoff(Request $request): void
    {
        $zone = InventoryZone::findByType('DAMAGED');
        if ($zone === null) {
            Response::success([
                'total_value'  => 0,
                'total_quantity' => 0,
                'items'        => [],
            ]);
        }

        $rows = Database::fetchAll(
            "SELECT p.inv_product_id, p.name, p.sku, p.uom,
                    s.current_quantity, p.standard_cost,
                    (s.current_quantity * p.standard_cost) AS write_off_value
             FROM inventory_stock s
             JOIN inventory_products p ON p.inv_product_id = s.inv_product_id AND p.tenant_id = s.tenant_id
             WHERE s.zone_id = ? AND s.current_quantity > 0 AND p.is_deleted = 0 AND s.tenant_id = ?
             ORDER BY write_off_value DESC",
            [(int)$zone['zone_id'], Database::tenantId()]
        );

        $items = [];
        $totalValue = 0.0;
        $totalQty   = 0.0;
        foreach ($rows as $r) {
            $value = round((float)$r['write_off_value'], 2);
            $totalValue += $value;
            $totalQty   += (float)$r['current_quantity'];
            $items[] = [
                'inv_product_id'  => (int)$r['inv_product_id'],
                'name'            => $r['name'],
                'sku'             => $r['sku'],
                'uom'             => $r['uom'],
                'quantity'        => (float)$r['current_quantity'],
                'unit_cost'       => (float)$r['standard_cost'],
                'write_off_value' => $value,
            ];
        }

        Response::success([
            'total_value'    => round($totalValue, 2),
            'total_quantity' => $totalQty,
            'items'          => $items,
        ]);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────
    /** Tenant-entered balance-sheet config value, or null if the tenant hasn't set it.
     *  Deliberately does NOT fall back to a hard-coded placeholder — a missing input
     *  must surface as "not available", not a fabricated number. */
    private static function configValueOrNull(string $key): ?float
    {
        $row = Database::fetch(
            'SELECT config_value FROM finance_config WHERE config_key = ? AND tenant_id = ? LIMIT 1',
            [$key, Database::tenantId()]
        );
        return $row ? (float)$row['config_value'] : null;
    }

    private static function validateDate($val, string $name): void
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$val) || !strtotime((string)$val)) {
            Response::error("`$name` must be a valid YYYY-MM-DD date", 422);
        }
    }
}
