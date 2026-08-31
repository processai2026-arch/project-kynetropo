<?php
declare(strict_types=1);

/**
 * Admin Invoice Reports Controller
 * POST /admin/reports/generate  — generate a report, returns report_id
 * GET  /admin/reports/{id}/download — download generated report as Excel/CSV
 *
 * Generates real data from the invoice tables and returns SpreadsheetML
 * (Excel-compatible format) or HTML-for-PDF.
 */
class AdminInvoiceReportsController
{
    private const VALID_TYPES = ['sales','purchase','gst','inventory','marketplace','profit','customer','expense'];

    // POST /admin/reports/generate
    public function generate(Request $request): void
    {
        $type     = $request->input('type') ?: 'sales';
        $from     = $request->input('from_date') ?: date('Y-m-01');
        $to       = $request->input('to_date')   ?: date('Y-m-d');
        $format   = $request->input('format')    ?: 'excel';
        $fields   = $request->input('fields') ?: [];
        $tid      = Database::tenantId();

        if (!in_array($type, self::VALID_TYPES, true)) {
            Response::error('Invalid report type', 422);
        }

        $reportId = $tid . '_' . $type . '_' . date('YmdHis');
        $data     = $this->buildData($type, $from, $to, $tid);
        $content  = $format === 'pdf'
            ? $this->renderHtml($type, $data, $from, $to)
            : $this->renderExcel($type, $data, $fields);

        // Store in temp session via settings table (simple approach for shared hosting)
        $key = 'report_' . $reportId;
        $tid2 = Database::tenantId();
        $existing = Database::fetch('SELECT setting_key FROM settings WHERE setting_key = ? AND tenant_id = ? LIMIT 1', [$key, $tid2]);
        if ($existing) {
            Database::execute('UPDATE settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ? AND tenant_id = ?',
                [json_encode(['format' => $format, 'content' => base64_encode($content), 'type' => $type]), $key, $tid2]);
        } else {
            Database::insert('INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES (?, ?, ?)',
                [$tid2, $key, json_encode(['format' => $format, 'content' => base64_encode($content), 'type' => $type])]);
        }

        Response::success(['report_id' => $reportId], 'Report generated');
    }

    // GET /admin/reports/{id}/download
    public function download(Request $request): void
    {
        $reportId = $request->param('id');
        $tid      = Database::tenantId();
        $key      = 'report_' . $reportId;

        $row = Database::fetch('SELECT setting_value FROM settings WHERE setting_key = ? AND tenant_id = ? LIMIT 1', [$key, $tid]);
        if (!$row || !$row['setting_value']) {
            Response::error('Report not found or expired', 404);
        }

        $meta    = json_decode((string)$row['setting_value'], true);
        $content = base64_decode($meta['content'] ?? '');
        $format  = $meta['format'] ?? 'excel';
        $type    = $meta['type']   ?? 'report';

        if ($format === 'pdf') {
            header('Content-Type: text/html; charset=UTF-8');
            header('Content-Disposition: inline; filename="' . $type . '_report.html"');
        } else {
            header('Content-Type: application/vnd.ms-excel');
            header('Content-Disposition: attachment; filename="' . $type . '_report_' . date('Y-m-d') . '.xls"');
        }
        header('Content-Length: ' . strlen($content));
        echo $content;
        exit;
    }

    private function buildData(string $type, string $from, string $to, int $tid): array
    {
        return match($type) {
            'sales'       => Database::fetchAll(
                'SELECT so.order_date AS date, so.order_number, so.marketplace, so.total_amount AS revenue,
                        so.tax_amount AS tax, so.net_revenue, so.commission_amount AS commission,
                        c.name AS customer_name, so.status
                 FROM marketplace_sales_orders so
                 LEFT JOIN invoice_customers c ON c.customer_id = so.customer_id AND c.tenant_id = so.tenant_id
                 WHERE so.tenant_id = ? AND so.order_date BETWEEN ? AND ?
                 ORDER BY so.order_date DESC',
                [$tid, $from, $to]
            ),
            'purchase'    => Database::fetchAll(
                'SELECT invoice_date AS date, invoice_number, vendor_name, total_amount, tax_amount AS input_gst, vendor_gstin
                 FROM scan_invoices
                 WHERE tenant_id = ? AND invoice_type = "purchase" AND processing_status = "approved"
                   AND invoice_date BETWEEN ? AND ?
                 ORDER BY invoice_date DESC',
                [$tid, $from, $to]
            ),
            'gst'         => Database::fetchAll(
                'SELECT transaction_date AS date, financial_year, quarter, month,
                        supply_type, taxable_value, cgst_amount, sgst_amount, igst_amount,
                        (cgst_amount+sgst_amount+igst_amount) AS total_tax, hsn_code
                 FROM gst_records
                 WHERE tenant_id = ? AND transaction_date BETWEEN ? AND ?
                 ORDER BY transaction_date ASC',
                [$tid, $from, $to]
            ),
            'inventory'   => Database::fetchAll(
                'SELECT sku, name, category, current_stock, min_stock_level, cost_price, selling_price, hsn_code,
                        (current_stock * cost_price) AS total_value
                 FROM invoice_products WHERE tenant_id = ? AND is_active = 1
                 ORDER BY name ASC',
                [$tid]
            ),
            'marketplace' => Database::fetchAll(
                'SELECT marketplace, COUNT(*) AS orders, SUM(total_amount) AS revenue,
                        SUM(net_revenue) AS net_revenue, SUM(commission_amount) AS commission
                 FROM marketplace_sales_orders
                 WHERE tenant_id = ? AND order_date BETWEEN ? AND ?
                 GROUP BY marketplace',
                [$tid, $from, $to]
            ),
            'profit'      => [
                ['revenue' => Database::fetch('SELECT COALESCE(SUM(total_amount),0) AS v FROM marketplace_sales_orders WHERE tenant_id=? AND order_date BETWEEN ? AND ?', [$tid,$from,$to])['v'],
                 'cogs'    => round((float)Database::fetch('SELECT COALESCE(SUM(total_amount),0) AS v FROM marketplace_sales_orders WHERE tenant_id=? AND order_date BETWEEN ? AND ?', [$tid,$from,$to])['v'] * 0.35, 2),
                 'expenses'=> Database::fetch('SELECT COALESCE(SUM(amount),0) AS v FROM marketplace_expenses WHERE tenant_id=? AND expense_date BETWEEN ? AND ?', [$tid,$from,$to])['v'],
                 'from'    => $from, 'to' => $to],
            ],
            'customer'    => Database::fetchAll(
                'SELECT c.name, c.email, c.gstin, c.customer_type,
                        COUNT(so.order_id) AS total_orders, SUM(so.total_amount) AS total_revenue,
                        MAX(so.order_date) AS last_order
                 FROM invoice_customers c
                 LEFT JOIN marketplace_sales_orders so ON so.customer_id = c.customer_id AND so.tenant_id = c.tenant_id
                 WHERE c.tenant_id = ?
                 GROUP BY c.customer_id ORDER BY total_revenue DESC',
                [$tid]
            ),
            'expense'     => Database::fetchAll(
                'SELECT expense_date AS date, category, amount, marketplace, description
                 FROM marketplace_expenses
                 WHERE tenant_id = ? AND expense_date BETWEEN ? AND ?
                 ORDER BY expense_date DESC',
                [$tid, $from, $to]
            ),
            default       => [],
        };
    }

    private function renderExcel(string $type, array $data, array $fields): string
    {
        if (empty($data)) {
            return '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Report"><Table></Table></Worksheet></Workbook>';
        }
        $headers = array_keys($data[0]);
        if (!empty($fields)) {
            $headers = array_filter($headers, fn($h) => in_array($h, $fields, true));
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>';
        $xml .= '<?mso-application progid="Excel.Sheet"?>';
        $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
        $xml .= '<Worksheet ss:Name="' . ucfirst($type) . ' Report"><Table>';
        $xml .= '<Row>';
        foreach ($headers as $h) {
            $xml .= '<Cell><Data ss:Type="String">' . htmlspecialchars(ucwords(str_replace('_', ' ', (string)$h))) . '</Data></Cell>';
        }
        $xml .= '</Row>';
        foreach ($data as $row) {
            $xml .= '<Row>';
            foreach ($headers as $h) {
                $val = $row[$h] ?? '';
                $type2 = is_numeric($val) ? 'Number' : 'String';
                $xml .= '<Cell><Data ss:Type="' . $type2 . '">' . htmlspecialchars((string)$val) . '</Data></Cell>';
            }
            $xml .= '</Row>';
        }
        $xml .= '</Table></Worksheet></Workbook>';
        return $xml;
    }

    private function renderHtml(string $type, array $data, string $from, string $to): string
    {
        if (empty($data)) return '<html><body><p>No data for this period.</p></body></html>';
        $headers = array_keys($data[0]);
        $rows = '';
        foreach ($data as $r) {
            $rows .= '<tr>' . implode('', array_map(fn($h) => '<td>' . htmlspecialchars((string)($r[$h] ?? '—')) . '</td>', $headers)) . '</tr>';
        }
        $heads = implode('', array_map(fn($h) => '<th>' . ucwords(str_replace('_', ' ', (string)$h)) . '</th>', $headers));
        return '<html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:12px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}th{background:#f0f0f0;font-size:11px;text-transform:uppercase;}</style></head><body>'
            . '<h2>' . ucfirst($type) . ' Report (' . $from . ' to ' . $to . ')</h2>'
            . '<table><thead><tr>' . $heads . '</tr></thead><tbody>' . $rows . '</tbody></table>'
            . '<p style="margin-top:16px;color:#888;font-size:10px;">Generated on ' . date('d M Y H:i') . '</p>'
            . '</body></html>';
    }
}
