<?php
declare(strict_types=1);

/**
 * Quotation Builder (Operations module).
 * Pick-and-play quotations: priced line items, each with a JSON list of spec
 * components (name + make + qty). Branded PDF is generated client-side from the
 * tenant company profile. All queries are tenant-scoped.
 *
 *  GET    /admin/quotations         index
 *  POST   /admin/quotations         store
 *  GET    /admin/quotations/{id}    show
 *  PUT    /admin/quotations/{id}    update
 *  DELETE /admin/quotations/{id}    destroy
 */
class AdminQuotationController
{
    public function index(Request $request): void
    {
        $tid = Database::tenantId();
        $rows = Database::fetchAll(
            'SELECT quotation_id, quotation_no, customer_name, particular, quotation_date,
                    subtotal, gst_rate, gst_amount, grand_total, status, created_at
             FROM quotations WHERE tenant_id = ? ORDER BY quotation_id DESC LIMIT 500',
            [$tid]
        );
        Response::success($rows, 'Quotations');
    }

    public function show(Request $request): void
    {
        $id  = (int) $request->param('id');
        $tid = Database::tenantId();
        $q = Database::fetch(
            'SELECT * FROM quotations WHERE quotation_id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tid]
        );
        if (!$q) {
            Response::error('Quotation not found', 404);
        }
        $q['items'] = $this->loadItems($id, $tid);
        Response::success($q, 'Quotation');
    }

    public function store(Request $request): void
    {
        $data = $this->validatePayload($request);
        $tid  = Database::tenantId();

        $totals = $this->computeTotals($data['items'], $data['gst_rate']);
        $quotationNo = $this->nextQuotationNo($data['quotation_date']);

        $quotationId = Database::insertTenant('quotations', [
            'quotation_no'     => $quotationNo,
            'customer_name'    => $data['customer_name'],
            'customer_address' => $data['customer_address'],
            'particular'       => $data['particular'],
            'quotation_date'   => $data['quotation_date'],
            'subtotal'         => $totals['subtotal'],
            'gst_rate'         => $data['gst_rate'],
            'gst_amount'       => $totals['gst_amount'],
            'grand_total'      => $totals['grand_total'],
            'terms'            => $data['terms'],
            'notes'            => $data['notes'],
            'status'           => $data['status'],
        ]);

        $this->saveItems($quotationId, $data['items']);

        $saved = Database::fetch('SELECT * FROM quotations WHERE quotation_id = ? AND tenant_id = ?', [$quotationId, $tid]);
        $saved['items'] = $this->loadItems($quotationId, $tid);
        Response::success($saved, 'Quotation created', 201);
    }

    public function update(Request $request): void
    {
        $id  = (int) $request->param('id');
        $tid = Database::tenantId();
        $existing = Database::fetch('SELECT quotation_id FROM quotations WHERE quotation_id = ? AND tenant_id = ?', [$id, $tid]);
        if (!$existing) {
            Response::error('Quotation not found', 404);
        }

        $data   = $this->validatePayload($request);
        $totals = $this->computeTotals($data['items'], $data['gst_rate']);

        Database::execute(
            'UPDATE quotations SET customer_name = ?, customer_address = ?, particular = ?, quotation_date = ?,
                    subtotal = ?, gst_rate = ?, gst_amount = ?, grand_total = ?, terms = ?, notes = ?, status = ?,
                    updated_at = NOW()
             WHERE quotation_id = ? AND tenant_id = ?',
            [
                $data['customer_name'], $data['customer_address'], $data['particular'], $data['quotation_date'],
                $totals['subtotal'], $data['gst_rate'], $totals['gst_amount'], $totals['grand_total'],
                $data['terms'], $data['notes'], $data['status'], $id, $tid,
            ]
        );

        Database::execute('DELETE FROM quotation_items WHERE quotation_id = ? AND tenant_id = ?', [$id, $tid]);
        $this->saveItems($id, $data['items']);

        $saved = Database::fetch('SELECT * FROM quotations WHERE quotation_id = ? AND tenant_id = ?', [$id, $tid]);
        $saved['items'] = $this->loadItems($id, $tid);
        Response::success($saved, 'Quotation updated');
    }

    public function destroy(Request $request): void
    {
        $id  = (int) $request->param('id');
        $tid = Database::tenantId();
        $existing = Database::fetch('SELECT quotation_id FROM quotations WHERE quotation_id = ? AND tenant_id = ?', [$id, $tid]);
        if (!$existing) {
            Response::error('Quotation not found', 404);
        }
        Database::execute('DELETE FROM quotation_items WHERE quotation_id = ? AND tenant_id = ?', [$id, $tid]);
        Database::execute('DELETE FROM quotations WHERE quotation_id = ? AND tenant_id = ?', [$id, $tid]);
        Response::success(['quotation_id' => $id], 'Quotation deleted');
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function validatePayload(Request $request): array
    {
        $customer = trim((string) $request->input('customer_name', ''));
        if ($customer === '') {
            Response::error('Customer name (M/S) is required', 422);
        }
        $items = $request->input('items');
        if (!is_array($items) || count($items) === 0) {
            Response::error('At least one line item is required', 422);
        }

        $clean = [];
        foreach ($items as $it) {
            $name = trim((string) ($it['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $qty  = (float) ($it['qty'] ?? 0);
            $rate = (float) ($it['rate'] ?? 0);
            $amount = isset($it['amount']) && $it['amount'] !== '' && $it['amount'] !== null
                ? (float) $it['amount']
                : ($qty > 0 ? $qty * $rate : $rate);

            $components = [];
            if (isset($it['components']) && is_array($it['components'])) {
                foreach ($it['components'] as $c) {
                    $cn = trim((string) ($c['name'] ?? ''));
                    if ($cn === '' && trim((string) ($c['group'] ?? '')) === '') {
                        continue;
                    }
                    $components[] = [
                        'group' => trim((string) ($c['group'] ?? '')),
                        'name'  => $cn,
                        'make'  => trim((string) ($c['make'] ?? '')),
                        'qty'   => (float) ($c['qty'] ?? 0),
                    ];
                }
            }

            $clean[] = [
                'name'       => $name,
                'make'       => trim((string) ($it['make'] ?? '')),
                'qty'        => $qty,
                'unit'       => trim((string) ($it['unit'] ?? '')),
                'rate'       => $rate,
                'amount'     => $amount,
                'components' => $components,
            ];
        }
        if (count($clean) === 0) {
            Response::error('At least one valid line item is required', 422);
        }

        $gstRate = $request->input('gst_rate');
        $gstRate = $gstRate === null || $gstRate === '' ? 18.0 : (float) $gstRate;

        $status = (string) $request->input('status', 'Draft');
        if (!in_array($status, ['Draft', 'Sent', 'Accepted', 'Rejected'], true)) {
            $status = 'Draft';
        }

        return [
            'customer_name'    => $customer,
            'customer_address' => trim((string) $request->input('customer_address', '')) ?: null,
            'particular'       => trim((string) $request->input('particular', '')) ?: null,
            'quotation_date'   => $this->normalizeDate((string) $request->input('quotation_date', '')),
            'gst_rate'         => $gstRate,
            'terms'            => trim((string) $request->input('terms', '')) ?: null,
            'notes'            => trim((string) $request->input('notes', '')) ?: null,
            'status'           => $status,
            'items'            => $clean,
        ];
    }

    private function computeTotals(array $items, float $gstRate): array
    {
        $subtotal = 0.0;
        foreach ($items as $it) {
            $subtotal += (float) $it['amount'];
        }
        $gstAmount = round($subtotal * $gstRate / 100, 2);
        return [
            'subtotal'    => round($subtotal, 2),
            'gst_amount'  => $gstAmount,
            'grand_total' => round($subtotal + $gstAmount, 2),
        ];
    }

    private function saveItems(int $quotationId, array $items): void
    {
        $order = 0;
        foreach ($items as $it) {
            Database::insertTenant('quotation_items', [
                'quotation_id' => $quotationId,
                'sort_order'   => $order++,
                'name'         => $it['name'],
                'make'         => $it['make'] ?: null,
                'qty'          => $it['qty'],
                'unit'         => $it['unit'] ?: null,
                'rate'         => $it['rate'],
                'amount'       => $it['amount'],
                'components'   => json_encode($it['components'] ?? []),
            ]);
        }
    }

    private function loadItems(int $quotationId, int $tid): array
    {
        $rows = Database::fetchAll(
            'SELECT item_id, sort_order, name, make, qty, unit, rate, amount, components
             FROM quotation_items WHERE quotation_id = ? AND tenant_id = ? ORDER BY sort_order ASC, item_id ASC',
            [$quotationId, $tid]
        );
        foreach ($rows as &$r) {
            $decoded = $r['components'] ? json_decode((string) $r['components'], true) : [];
            $r['components'] = is_array($decoded) ? $decoded : [];
        }
        return $rows;
    }

    private function nextQuotationNo(?string $date): string
    {
        $tid   = Database::tenantId();
        $count = (int) (Database::fetch('SELECT COUNT(*) AS c FROM quotations WHERE tenant_id = ?', [$tid])['c'] ?? 0);
        $seq   = str_pad((string) ($count + 1), 3, '0', STR_PAD_LEFT);
        $ts    = strtotime($date ?: 'now') ?: time();
        $y     = (int) date('Y', $ts);
        $m     = (int) date('n', $ts);
        $start = $m >= 4 ? $y : $y - 1;            // Indian financial year starts in April
        $fy    = sprintf('%02d-%02d', $start % 100, ($start + 1) % 100);
        return "QT/{$seq}/{$fy}";
    }

    private function normalizeDate(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return date('Y-m-d');
        }
        $ts = strtotime($value);
        return $ts ? date('Y-m-d', $ts) : date('Y-m-d');
    }
}
