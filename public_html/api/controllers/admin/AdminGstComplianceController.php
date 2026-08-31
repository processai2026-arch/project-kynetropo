<?php
declare(strict_types=1);

class AdminGstComplianceController
{
    public function index(Request $request): void
    {
        $result = GstCompliance::all(
            (int)$request->query('page', 1),
            (int)$request->query('limit', 500)
        );
        Response::paginated($result['rows'], $result['pagination']);
    }

    public function show(Request $request): void
    {
        $period = GstCompliance::periodKey((string)$request->param('period'));
        Response::success([
            'saved' => GstCompliance::find($period),
            'calculated' => GstCompliance::calculate($period),
        ]);
    }

    public function calculate(Request $request): void
    {
        $period = GstCompliance::periodKey((string)($request->query('period') ?: $request->param('period')));
        Response::success(GstCompliance::calculate($period));
    }

    public function save(Request $request): void
    {
        $period = GstCompliance::periodKey((string)$request->param('period'));
        $saved = GstCompliance::saveSnapshot($period, $this->actorId($request));
        $this->audit($request, 'gst_period_saved', 'gst_compliance_periods', (int)$saved['period_id'], null, $saved);
        Response::success($saved, 'GST period snapshot saved');
    }

    public function review(Request $request): void
    {
        $this->status($request, 'reviewed', 'GST period reviewed');
    }

    public function file(Request $request): void
    {
        $filedOn = $request->input('filed_on') ? Payment::validDateOrDefault((string)$request->input('filed_on'), date('Y-m-d')) : date('Y-m-d');
        $reference = $request->input('reference_no') ? Request::sanitize((string)$request->input('reference_no')) : null;
        $this->status($request, 'filed', 'GST period filed', ['filed_on' => $filedOn, 'reference_no' => $reference]);
    }

    public function lock(Request $request): void
    {
        $this->status($request, 'locked', 'GST period locked');
    }

    public function export(Request $request): void
    {
        $period = GstCompliance::periodKey((string)$request->param('period'));
        Response::success(GstCompliance::export($period), 'GST export generated');
    }

    // POST /admin/gst-compliance/invoices/{id}/irn
    // Accepts an IRN/QR supplied by a GSP, calls a configured GSP when available,
    // or creates an explicit placeholder for non-production/test environments.
    public function generateIrn(Request $request): void
    {
        $invoiceId = (int)$request->param('id');
        $invoice = Database::fetch(
            'SELECT * FROM invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1',
            [$invoiceId, Database::tenantId()]
        );
        if (!$invoice) {
            Response::error('Invoice not found', 404);
        }

        $providedIrn = trim((string)$request->input('irn'));
        $providedQr = trim((string)$request->input('irn_qr'));
        $force = (bool)$request->input('force', false);
        if (!$force && !empty($invoice['irn']) && in_array((string)$invoice['irn_status'], ['generated', 'provided'], true)) {
            Response::success($invoice, 'IRN already generated');
        }

        $irn = $providedIrn;
        $qr = $providedQr;
        $status = $irn !== '' ? 'provided' : 'placeholder';
        $providerResponse = null;

        $gspUrl = trim((string)(getenv('EINVOICE_GSP_URL') ?: ''));
        if ($irn === '' && $gspUrl !== '') {
            try {
                $providerResponse = $this->callGsp($gspUrl, $invoice);
                $irn = trim((string)($providerResponse['irn'] ?? $providerResponse['Irn'] ?? ''));
                $qr = trim((string)($providerResponse['irn_qr'] ?? $providerResponse['qr'] ?? $providerResponse['SignedQRCode'] ?? ''));
                if ($irn === '') {
                    throw new \RuntimeException('GSP response did not include an IRN');
                }
                $status = 'generated';
            } catch (\Throwable $e) {
                Database::execute(
                    "UPDATE invoices SET irn_status = 'failed', updated_at = NOW() WHERE invoice_id = ? AND tenant_id = ?",
                    [$invoiceId, Database::tenantId()]
                );
                Response::error('IRN generation failed: ' . $e->getMessage(), 502);
            }
        }

        if ($irn === '') {
            $irn = 'PLACEHOLDER-' . strtoupper(substr(hash(
                'sha256',
                Database::tenantId() . '|' . $invoice['invoice_number'] . '|' . ($invoice['invoice_date'] ?? $invoice['created_at'])
            ), 0, 52));
            $qr = $qr !== '' ? $qr : json_encode([
                'placeholder' => true,
                'invoice_number' => $invoice['invoice_number'],
                'invoice_date' => $invoice['invoice_date'] ?? substr((string)$invoice['created_at'], 0, 10),
                'total' => (float)$invoice['total'],
                'irn' => $irn,
            ], JSON_UNESCAPED_SLASHES);
        }

        Database::execute(
            'UPDATE invoices SET irn = ?, irn_qr = ?, irn_status = ?, updated_at = NOW()
             WHERE invoice_id = ? AND tenant_id = ?',
            [$irn, $qr ?: null, $status, $invoiceId, Database::tenantId()]
        );
        $saved = Database::fetch(
            'SELECT invoice_id, invoice_number, irn, irn_qr, irn_status, updated_at
             FROM invoices WHERE invoice_id = ? AND tenant_id = ?',
            [$invoiceId, Database::tenantId()]
        );
        $this->audit($request, 'invoice_irn_' . $status, 'invoices', $invoiceId, [
            'irn' => $invoice['irn'] ?? null,
            'irn_status' => $invoice['irn_status'] ?? null,
        ], $saved);
        if ($providerResponse !== null) {
            $saved['provider_response'] = $providerResponse;
        }
        Response::success($saved, $status === 'placeholder' ? 'Placeholder IRN generated' : 'IRN stored');
    }

    private function callGsp(string $url, array $invoice): array
    {
        if (!function_exists('curl_init')) {
            throw new \RuntimeException('cURL is required for the configured e-invoice GSP');
        }
        $items = Database::fetchAll(
            'SELECT description, hsn_code, quantity, unit, unit_price, gst_rate, line_total
             FROM invoice_items WHERE invoice_id = ? AND tenant_id = ? ORDER BY sort_order, item_id',
            [(int)$invoice['invoice_id'], Database::tenantId()]
        );
        $payload = json_encode(['invoice' => $invoice, 'items' => $items], JSON_UNESCAPED_SLASHES);
        $headers = ['Content-Type: application/json'];
        $token = trim((string)(getenv('EINVOICE_GSP_TOKEN') ?: ''));
        if ($token !== '') {
            $headers[] = 'Authorization: Bearer ' . $token;
        }
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 30,
        ]);
        $body = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        if ($body === false || $status < 200 || $status >= 300) {
            throw new \RuntimeException($error ?: 'GSP returned HTTP ' . $status);
        }
        $decoded = json_decode((string)$body, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('GSP returned invalid JSON');
        }
        return isset($decoded['data']) && is_array($decoded['data']) ? $decoded['data'] : $decoded;
    }

    private function status(Request $request, string $status, string $message, array $extra = []): void
    {
        $period = GstCompliance::periodKey((string)$request->param('period'));
        $before = GstCompliance::find($period);
        $data = $extra;
        if ($request->input('notes') !== null) {
            $data['notes'] = Request::sanitize((string)$request->input('notes'));
        }
        $saved = GstCompliance::updateStatus($period, $status, $data, $this->actorId($request));
        $this->audit($request, 'gst_period_' . $status, 'gst_compliance_periods', (int)$saved['period_id'], $before, $saved);
        Response::success($saved, $message);
    }

    private function actorId(Request $request): int
    {
        return isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
    }

    private function audit(Request $request, string $action, string $table, int $id, mixed $before, mixed $after): void
    {
        Database::execute(
            'INSERT INTO audit_log (tenant_id, user_id, action, table_name, record_id, old_value, new_value, ip_address, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [
                Database::tenantId(),
                $this->actorId($request) ?: null,
                $action,
                $table,
                $id,
                $before !== null ? json_encode($before) : null,
                $after !== null ? json_encode($after) : null,
                $request->ip(),
            ]
        );
    }
}
