<?php
declare(strict_types=1);

/**
 * Admin GST Controller
 * GET /admin/gst/summary            — FY overview
 * GET /admin/gst/monthly/{yr}/{mo}  — per-month records
 * GET /admin/gst/hsn-summary        — HSN aggregation
 */
class AdminGSTController
{
    public function summary(Request $request): void
    {
        $tid  = Database::tenantId();
        $year = (int)($request->query('year') ?: date('Y'));
        // Financial year starts in April
        $fyStart = $year; $fyEnd = (string)($year + 1);
        $fyString = $year . '-' . substr($fyEnd, 2);

        $outputTax = (float)(Database::fetch(
            'SELECT COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) AS total
             FROM gst_records WHERE tenant_id = ? AND financial_year = ?',
            [$tid, $fyString]
        )['total'] ?? 0);
        $inputTaxCredit = 0.0;
        $netPayable = max(0.0, $outputTax - $inputTaxCredit);

        $monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        $monthlyRows = Database::fetchAll(
            'SELECT month, SUM(taxable_value) AS taxable_value,
                    SUM(cgst_amount) AS cgst, SUM(sgst_amount) AS sgst,
                    SUM(igst_amount) AS igst,
                    SUM(cgst_amount + sgst_amount + igst_amount) AS total
             FROM gst_records
             WHERE tenant_id = ? AND financial_year = ?
             GROUP BY month ORDER BY month',
            [$tid, $fyString]
        );
        $monthly = [];
        foreach ($monthlyRows as $mr) {
            $monthly[] = [
                'month_num'     => (int)$mr['month'],
                'month_name'    => $monthNames[(int)$mr['month'] - 1],
                'taxable_value' => (float)$mr['taxable_value'],
                'cgst'          => (float)$mr['cgst'],
                'sgst'          => (float)$mr['sgst'],
                'igst'          => (float)$mr['igst'],
                'total'         => (float)$mr['total'],
            ];
        }

        // Quarters: Q1=Apr-Jun(4-6), Q2=Jul-Sep(7-9), Q3=Oct-Dec(10-12), Q4=Jan-Mar(1-3)
        $quarters = [];
        $qDef = [[4,5,6],[7,8,9],[10,11,12],[1,2,3]];
        foreach ($qDef as $qi => $months) {
            $ph = implode(',', array_fill(0, count($months), '?'));
            $qr = Database::fetch(
                "SELECT COALESCE(SUM(cgst_amount + sgst_amount + igst_amount), 0) AS output
                 FROM gst_records WHERE tenant_id = ? AND financial_year = ? AND month IN ($ph)",
                [$tid, $fyString, ...$months]
            );
            $quarters[] = [
                'quarter'   => 'Q' . ($qi + 1),
                'output'    => (float)($qr['output'] ?? 0),
                'input'     => 0.0,
                'payable'   => (float)($qr['output'] ?? 0),
            ];
        }

        Response::success([
            'financial_year'    => $fyString,
            'output_tax'        => $outputTax,
            'input_tax_credit'  => $inputTaxCredit,
            'net_payable'       => $netPayable,
            'monthly'           => $monthly,
            'quarterly'         => $quarters,
        ]);
    }

    public function monthly(Request $request): void
    {
        $year  = (int)$request->param('year');
        $month = (int)$request->param('month');
        $tid   = Database::tenantId();
        if ($year < 2000 || $month < 1 || $month > 12) Response::error('Invalid year or month', 400);
        $fy = ($month >= 4) ? "$year-" . substr((string)($year + 1), 2) : ($year - 1) . '-' . substr((string)$year, 2);
        $rows = Database::fetchAll(
            'SELECT gr.*, si.invoice_number, si.vendor_name
             FROM gst_records gr
             LEFT JOIN scan_invoices si ON si.invoice_id = gr.invoice_id AND si.tenant_id = gr.tenant_id
             WHERE gr.tenant_id = ? AND gr.financial_year = ? AND gr.month = ?
             ORDER BY gr.transaction_date ASC',
            [$tid, $fy, $month]
        );
        foreach ($rows as &$r) {
            foreach (['taxable_value','cgst_amount','sgst_amount','igst_amount','total_tax'] as $f) {
                $r[$f] = (float)$r[$f];
            }
        }
        Response::success(['records' => $rows, 'count' => count($rows), 'financial_year' => $fy, 'month' => $month]);
    }

    public function hsnSummary(Request $request): void
    {
        $tid  = Database::tenantId();
        // Default to current FY (April to now) so data is always visible
        $currentMonth = (int)date('n');
        $fyStart = $currentMonth >= 4 ? date('Y') . '-04-01' : (date('Y') - 1) . '-04-01';
        $from = $request->query('from_date') ?: $fyStart;
        $to   = $request->query('to_date')   ?: date('Y-m-d');
        $rows = Database::fetchAll(
            'SELECT hsn_code, COUNT(*) AS txn_count,
                    SUM(taxable_value) AS taxable_value,
                    SUM(cgst_amount + sgst_amount + igst_amount) AS total_tax
             FROM gst_records
             WHERE tenant_id = ? AND transaction_date BETWEEN ? AND ? AND hsn_code IS NOT NULL
             GROUP BY hsn_code
             ORDER BY taxable_value DESC',
            [$tid, $from, $to]
        );
        foreach ($rows as &$r) {
            $r['taxable_value'] = (float)$r['taxable_value'];
            $r['total_tax']     = (float)$r['total_tax'];
            $r['txn_count']     = (int)$r['txn_count'];
        }
        Response::success($rows);
    }
}
