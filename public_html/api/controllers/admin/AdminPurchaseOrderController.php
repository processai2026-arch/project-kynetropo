<?php
declare(strict_types=1);

// api/index.php pre-loads every other model explicitly but is out of scope for
// this change, so the new VendorBill model is required here instead.
// require_once is idempotent — safe even if a future index.php update also loads it.
require_once __DIR__ . '/../../models/VendorBill.php';

class AdminPurchaseOrderController
{
    /**
     * GET /admin/purchase-orders                    PO list (default)
     * GET /admin/purchase-orders?view=bills          Vendor bill list (tenant-wide)
     * GET /admin/purchase-orders?view=match           Tenant-wide three-way-match mismatch report
     */
    public function index(Request $request): void
    {
        $view = (string)$request->query('view', 'orders');

        if ($view === 'bills') {
            $this->billsIndex($request);
            return;
        }
        if ($view === 'match') {
            $this->matchReport($request);
            return;
        }

        $result = PurchaseOrder::all(
            [
                'status' => $request->query('status'),
                'vendor_id' => $request->query('vendor_id'),
                'from' => $request->query('from'),
                'to' => $request->query('to'),
            ],
            (int)$request->query('page', 1),
            (int)$request->query('limit', 500)
        );
        Response::paginated($result['rows'], $result['pagination']);
    }

    /** Tenant-wide vendor bill list — GET /admin/purchase-orders?view=bills */
    private function billsIndex(Request $request): void
    {
        $result = VendorBill::all(
            [
                'status' => $request->query('status'),
                'vendor_id' => $request->query('vendor_id'),
                'po_id' => $request->query('po_id'),
            ],
            (int)$request->query('page', 1),
            (int)$request->query('limit', 500)
        );
        Response::paginated($result['rows'], $result['pagination']);
    }

    /** Tenant-wide three-way-match mismatch report — GET /admin/purchase-orders?view=match */
    private function matchReport(Request $request): void
    {
        $onlyMismatched = filter_var($request->query('mismatched_only', '1'), FILTER_VALIDATE_BOOLEAN);
        $statuses = ['issued', 'partially_received', 'received', 'short_closed', 'billed', 'paid'];
        $rows = Database::fetchAll(
            'SELECT po_id FROM purchase_orders WHERE tenant_id = ? AND status IN ("' . implode('","', $statuses) . '")
             ORDER BY created_at DESC LIMIT 200',
            [Database::tenantId()]
        );

        $report = [];
        foreach ($rows as $row) {
            $po = PurchaseOrder::findById((int)$row['po_id']);
            if ($po === null) {
                continue;
            }
            $match = $po['three_way_match'];
            if ($onlyMismatched && $match['matched']) {
                continue;
            }
            $report[] = [
                'po_id' => $po['po_id'],
                'po_number' => $po['po_number'],
                'vendor_name' => $po['vendor_name'],
                'status' => $po['status'],
                'matched' => $match['matched'],
                'po_total' => $match['po_total'],
                'received_total' => $match['received_total'],
                'billed_total' => $match['billed_total'],
                'value_variance' => $match['value_variance'],
                'mismatched_lines' => count(array_filter($match['lines'], fn(array $l): bool => !$l['matched'])),
            ];
        }

        Response::success(['rows' => $report, 'count' => count($report)]);
    }

    public function store(Request $request): void
    {
        $data = $this->headerPayload($request, true);
        $items = $this->itemsPayload($request->input('items', []), (int)($data['pr_id'] ?? 0));

        Database::beginTransaction();
        try {
            $data['po_number'] = !empty($data['po_number'])
                ? $data['po_number']
                : NumberSequence::next('PO');
            $this->ensureUniquePoNumber($data['po_number']);
            $data['created_by'] = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;
            $id = PurchaseOrder::create($data, $items);
            if (!empty($data['pr_id'])) {
                PurchaseRequest::transition((int)$data['pr_id'], 'converted');
            }
            $this->audit($request, 'po_created', 'purchase_orders', $id, null, ['po_number' => $data['po_number']]);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            error_log('PO create error: ' . $e->getMessage());
            Response::error('Could not create purchase order', 500);
        }

        Response::success(PurchaseOrder::findById($id), 'Purchase order created', 201);
    }

    /**
     * GET /admin/purchase-orders/{id}                    PO detail (default; includes bills + three_way_match)
     * GET /admin/purchase-orders/{id}?bill_id=NNN         Single vendor bill detail (must belong to this PO)
     */
    public function show(Request $request): void
    {
        $po = $this->poOrFail((int)$request->param('id'));

        $billId = (int)$request->query('bill_id', 0);
        if ($billId > 0) {
            $bill = VendorBill::findById($billId);
            if (!$bill || $bill['po_id'] !== $po['po_id']) {
                Response::error('Vendor bill not found for this purchase order', 404);
            }
            Response::success($bill);
            return;
        }

        Response::success($po);
    }

    /**
     * PUT /admin/purchase-orders/{id}                                PO header/items update (draft only)
     * PUT /admin/purchase-orders/{id}  body: {bill_id, bill: {...}}   Vendor bill update, routed by bill_id
     */
    public function update(Request $request): void
    {
        $id = (int)$request->param('id');
        $existing = $this->poOrFail($id);

        $billId = (int)$request->input('bill_id', 0);
        if ($billId > 0) {
            $this->updateBill($request, $id, $billId);
            return;
        }

        if ($existing['status'] !== 'draft') {
            Response::error('Only draft purchase orders can be edited', 409);
        }

        $data = $this->headerPayload($request, false);
        $items = $request->input('items') !== null ? $this->itemsPayload($request->input('items'), 0) : null;
        if (empty($data) && $items === null) {
            Response::error('Provide at least one field to update', 400);
        }

        Database::beginTransaction();
        try {
            if (!empty($data['po_number'])) {
                $this->ensureUniquePoNumber($data['po_number'], $id);
            }
            PurchaseOrder::updateDraft($id, $data, $items);
            $this->audit($request, 'po_updated', 'purchase_orders', $id, $existing, ['header' => $data, 'items_changed' => $items !== null]);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            error_log('PO update error: ' . $e->getMessage());
            Response::error('Could not update purchase order', 500);
        }

        Response::success(PurchaseOrder::findById($id), 'Purchase order updated');
    }

    public function issue(Request $request): void
    {
        $this->transition($request, 'draft', 'issued', 'po_issued');
    }

    public function cancel(Request $request): void
    {
        $id = (int)$request->param('id');
        $po = $this->poOrFail($id);
        if (!in_array($po['status'], ['draft', 'issued'], true)) {
            Response::error('Only draft or unreceived issued POs can be cancelled', 409);
        }
        foreach ($po['items'] as $item) {
            if ((float)$item['received_qty'] > 0) {
                Response::error('Cannot cancel a PO after receipt; use short-close', 409);
            }
        }
        $this->transition($request, $po['status'], 'cancelled', 'po_cancelled');
    }

    public function shortClose(Request $request): void
    {
        $id = (int)$request->param('id');
        $po = $this->poOrFail($id);
        if (!in_array($po['status'], ['issued', 'partially_received'], true)) {
            Response::error('Only issued or partially received POs can be short-closed', 409);
        }
        $this->transition($request, $po['status'], 'short_closed', 'po_short_closed');
    }

    public function receive(Request $request): void
    {
        $id = (int)$request->param('id');
        $po = $this->poOrFail($id);
        if (!in_array($po['status'], ['issued', 'partially_received'], true)) {
            Response::error('PO must be issued before receiving', 409);
        }

        $payload = [
            'received_on' => trim((string)$request->input('received_on', date('Y-m-d'))),
            'notes' => trim((string)$request->input('notes', '')),
            'location_id' => (int)$request->input('location_id', Inventory::defaultLocationId()),
            'received_by' => isset($request->user['user_id']) ? (int)$request->user['user_id'] : null,
        ];
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $payload['received_on'])) {
            Response::error('received_on must be YYYY-MM-DD', 422);
        }

        $receiptItems = $request->input('items', []);
        if (is_string($receiptItems)) {
            $decoded = json_decode($receiptItems, true);
            $receiptItems = is_array($decoded) ? $decoded : [];
        }
        $lines = $this->receiptLinesPayload($receiptItems, $po);

        Database::beginTransaction();
        try {
            $payload['grn_number'] = NumberSequence::next('GRN');
            $grnId = PurchaseOrder::createReceipt($id, $payload, $lines);
            $photo = $this->uploadedReceiptPhoto();
            if ($photo !== null) {
                $stored = FileStore::put('po_document', $photo, 'procurement');
                FileStore::createAttachment(
                    'grn',
                    $grnId,
                    'delivery_photo',
                    $stored,
                    isset($request->user['user_id']) ? (int)$request->user['user_id'] : null
                );
            }
            $this->audit($request, 'grn_created', 'goods_receipts', $grnId, null, ['po_id' => $id, 'grn_number' => $payload['grn_number']]);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            error_log('GRN create error: ' . $e->getMessage());
            Response::error('Could not receive goods', 500);
        }

        // ── Smart Inventory hook: auto stock-in + allocation for received lines ──
        // Failures here must never break the GRN itself, which already committed above.
        try {
            $this->syncInventoryFromGrn($grnId, $lines, $request);
        } catch (Throwable $e) {
            error_log('Inventory sync from GRN #' . $grnId . ' failed: ' . $e->getMessage());
        }

        Response::success(PurchaseOrder::findById($id), 'Goods receipt created', 201);
    }

    /**
     * Smart Inventory interconnection — for each received line that maps to an
     * inventory product (via inventory_products.source_product_id), record a
     * STOCK_IN movement, run the Smart Allocation Engine, and mark any matching
     * PENDING reorder suggestion as ORDERED.
     *
     * Idempotency: this runs outside the GRN's own DB transaction (inventory
     * failures must never roll back an already-committed GRN — see receive()),
     * so it must tolerate being invoked more than once for the same GRN (client
     * retry, double-submit, queue redelivery, etc). Before recording a STOCK_IN
     * we check whether one already exists for this GRN + inventory product; if
     * so we skip both the movement insert and the allocation call for that line
     * so a re-post never double-counts stock or re-runs Smart Allocation.
     */
    private function syncInventoryFromGrn(int $grnId, array $lines, Request $request): void
    {
        $allocationEngine = new SmartAllocationEngine();
        $actorId          = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;
        $ip               = $request->ip();

        foreach ($lines as $line) {
            if (empty($line['product_id'])) {
                continue;
            }
            $invProductId = $this->findInventoryProduct((int)$line['product_id']);
            if ($invProductId === null) {
                continue;
            }

            // Guard: a STOCK_IN movement for this GRN + product already exists
            // (e.g. a retried/duplicate receive() call) — skip re-creating the
            // movement and re-running allocation so the effect stays single-fire.
            $existing = Database::fetch(
                "SELECT movement_id FROM inventory_stock_movements
                 WHERE reference_type = 'PURCHASE_ORDER' AND reference_id = ?
                   AND inv_product_id = ? AND movement_type = 'STOCK_IN' AND tenant_id = ?
                 LIMIT 1",
                [$grnId, $invProductId, Database::tenantId()]
            );
            if ($existing !== null) {
                continue;
            }

            $zone = InventoryZone::findByType('RAW_MATERIAL') ?? InventoryZone::findByType('READY_STOCK');
            if ($zone === null) {
                continue;
            }

            $movementId = InventoryMovement::recordMovement([
                'inv_product_id'  => $invProductId,
                'zone_id'         => (int)$zone['zone_id'],
                'movement_type'   => 'STOCK_IN',
                'quantity'        => (float)$line['quantity'],
                'unit_cost'       => (float)$line['unit_cost'],
                'reference_type'  => 'PURCHASE_ORDER',
                'reference_id'    => $grnId,
                'moved_by'        => $actorId,
                'approved_by'     => $actorId,
                'approval_status' => 'APPROVED',
                'remarks'         => 'Auto stock-in from GRN #' . $grnId,
            ]);
            InventoryStock::upsertStock($invProductId, (int)$zone['zone_id'], (float)$line['quantity']);
            InventoryStock::updateHealthScore($invProductId);

            $allocationEngine->allocate($invProductId, (float)$line['quantity'], $movementId, $actorId, $ip);

            Database::execute(
                "UPDATE inventory_reorder_suggestions
                 SET status = 'ORDERED'
                 WHERE inv_product_id = ? AND tenant_id = ? AND status = 'PENDING'",
                [$invProductId, Database::tenantId()]
            );
        }
    }

    /** Look up inventory_products.inv_product_id by the linked catalog product. */
    private function findInventoryProduct(int $sourceProductId): ?int
    {
        $row = Database::fetch(
            'SELECT inv_product_id FROM inventory_products WHERE source_product_id = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1',
            [$sourceProductId, Database::tenantId()]
        );
        return $row !== null ? (int)$row['inv_product_id'] : null;
    }

    /**
     * Bill a PO — creates a real Vendor Bill (header + line items, linked to the
     * PO and its GRN(s)) instead of booking the PO total as a generic expense.
     * A mirrored `expenses` row is still written for backward-compat with the
     * existing cash/expense reporting surfaces, but `vendor_bills` is now the
     * authoritative procurement record.
     */
    public function bill(Request $request): void
    {
        $id = (int)$request->param('id');
        $po = $this->poOrFail($id);
        if (!in_array($po['status'], ['received', 'short_closed'], true)) {
            Response::error('Only received or short-closed POs can be billed', 409);
        }
        if (!empty($po['billed_expense_id'])) {
            Response::error('PO is already billed', 409);
        }

        $vendorInvoiceNumber = trim((string)$request->input('vendor_invoice_number', ''));
        $billDate = trim((string)$request->input('bill_date', date('Y-m-d')));
        $dueDate = trim((string)$request->input('due_date', ''));
        foreach (['bill_date' => $billDate, 'due_date' => $dueDate] as $label => $value) {
            if ($value !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                Response::error("{$label} must be YYYY-MM-DD", 422);
            }
        }
        if ($vendorInvoiceNumber !== '' && VendorBill::duplicateInvoiceHint((int)$po['vendor_id'], $vendorInvoiceNumber)) {
            Response::error('A bill with this vendor invoice number already exists for this vendor', 409);
        }

        $paymentMode = trim((string)$request->input('payment_mode', 'Bank Transfer'));
        if (!in_array($paymentMode, ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'], true)) {
            Response::error('payment_mode must be one of: Cash, Bank Transfer, UPI, Cheque, Card', 422);
        }

        $billItems = $this->billItemsPayload($request->input('items'), $po);
        $grnIds = array_map(
            fn(array $r): int => (int)$r['grn_id'],
            array_filter($po['receipts'], fn(array $r): bool => $r['status'] === 'posted')
        );

        Database::beginTransaction();
        try {
            $actorId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;
            $expenseCode = substr('POE' . date('ymdHis') . $id, 0, 20);
            $expenseId = Database::insertTenant('expenses', [
                'expense_code' => $expenseCode,
                'expense_date' => date('Y-m-d'),
                'category'     => 'Material Purchase',
                'vendor'       => $po['vendor_name'],
                'description'  => 'Purchase order ' . $po['po_number'] . ($vendorInvoiceNumber !== '' ? ' / Inv ' . $vendorInvoiceNumber : ''),
                'amount'       => $po['total'],
                'payment_mode' => $paymentMode,
                'created_by'   => $actorId,
                'created_at'   => date('Y-m-d H:i:s'),
            ]);

            $billNumber = 'BILL-' . date('ymd') . '-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT) . '-' . substr((string)time(), -4);
            $billId = VendorBill::create([
                'bill_number'           => $billNumber,
                'vendor_invoice_number' => $vendorInvoiceNumber,
                'vendor_id'             => $po['vendor_id'],
                'po_id'                 => $id,
                'bill_date'             => $billDate,
                'due_date'              => $dueDate,
                'other_charges'         => $po['other_charges'],
                'status'                => 'approved',
                'notes'                 => trim((string)$request->input('notes', '')),
                'expense_id'            => $expenseId,
                'created_by'            => $actorId,
            ], $billItems, $grnIds);

            Database::execute('UPDATE purchase_orders SET status = "billed", billed_expense_id = ?, updated_at = NOW() WHERE po_id = ? AND tenant_id = ?', [$expenseId, $id, Database::tenantId()]);
            $this->audit($request, 'po_billed', 'purchase_orders', $id, ['status' => $po['status']], ['status' => 'billed', 'expense_id' => $expenseId, 'bill_id' => $billId]);
            $this->audit($request, 'vendor_bill_created', 'vendor_bills', $billId, null, ['bill_number' => $billNumber, 'po_id' => $id]);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            error_log('PO bill error: ' . $e->getMessage());
            Response::error('Could not bill purchase order', 500);
        }

        Response::success(PurchaseOrder::findById($id), 'Purchase order billed');
    }

    /** PUT .../{id} body {bill_id, vendor_invoice_number?, bill_date?, due_date?, notes?, items?, status?} */
    private function updateBill(Request $request, int $poId, int $billId): void
    {
        $bill = VendorBill::findById($billId);
        if (!$bill || $bill['po_id'] !== $poId) {
            Response::error('Vendor bill not found for this purchase order', 404);
        }
        if ($bill['status'] === 'void') {
            Response::error('A void bill cannot be edited', 409);
        }

        $status = $request->input('status');
        if ($status !== null) {
            if (!in_array($status, VendorBill::STATUSES, true)) {
                Response::error('Invalid bill status', 422);
            }
            $actorId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;
            VendorBill::transition($billId, $status, $actorId);
            $this->audit($request, 'vendor_bill_status_changed', 'vendor_bills', $billId, ['status' => $bill['status']], ['status' => $status]);
            Response::success(VendorBill::findById($billId), 'Vendor bill status updated');
            return;
        }

        $data = [];
        foreach (['vendor_invoice_number', 'bill_date', 'due_date', 'notes'] as $field) {
            if ($request->input($field) !== null) {
                $data[$field] = is_string($request->input($field)) ? trim((string)$request->input($field)) : $request->input($field);
            }
        }
        foreach (['bill_date' => $data['bill_date'] ?? null, 'due_date' => $data['due_date'] ?? null] as $label => $value) {
            if ($value !== null && $value !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                Response::error("{$label} must be YYYY-MM-DD", 422);
            }
        }
        if (isset($data['vendor_invoice_number']) && $data['vendor_invoice_number'] !== ''
            && VendorBill::duplicateInvoiceHint((int)$bill['vendor_id'], $data['vendor_invoice_number'], $billId)) {
            Response::error('A bill with this vendor invoice number already exists for this vendor', 409);
        }

        $po = $this->poOrFail($poId);
        $items = $request->input('items') !== null ? $this->billItemsPayload($request->input('items'), $po) : null;
        if (empty($data) && $items === null) {
            Response::error('Provide at least one field to update', 400);
        }

        Database::beginTransaction();
        try {
            VendorBill::update($billId, $data, $items);
            $this->audit($request, 'vendor_bill_updated', 'vendor_bills', $billId, $bill, ['header' => $data, 'items_changed' => $items !== null]);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            error_log('Vendor bill update error: ' . $e->getMessage());
            Response::error('Could not update vendor bill', 500);
        }

        Response::success(VendorBill::findById($billId), 'Vendor bill updated');
    }

    /**
     * GET .../{id}/pdf            generate the PO document (HTML) and return it
     * GET .../{id}/pdf?send=1     also email it to the vendor and record delivery status
     */
    public function pdf(Request $request): void
    {
        $po = $this->poOrFail((int)$request->param('id'));
        $html = $this->renderPoDocument($po);

        $send = filter_var($request->query('send', '0'), FILTER_VALIDATE_BOOLEAN);
        if (!$send) {
            Response::success(['purchase_order' => $po, 'document_html' => $html], 'Purchase order document generated');
            return;
        }

        $email = trim((string)$request->query('email', '')) ?: $this->vendorEmail((int)$po['vendor_id']);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Vendor does not have a valid email on file; pass ?email= to override', 422);
        }

        $sent = Mailer::send(
            $email,
            'Purchase Order ' . $po['po_number'],
            Mailer::layout('Purchase Order ' . $po['po_number'], $html)
        );

        $status = $sent ? 'sent' : 'failed';
        PurchaseOrder::recordDelivery((int)$po['po_id'], $status, $email);
        $this->audit($request, 'po_emailed', 'purchase_orders', (int)$po['po_id'], null, ['email' => $email, 'status' => $status]);

        if (!$sent) {
            Response::error('Email delivery failed (SMTP not configured or send error) — see server log', 502);
        }

        Response::success(PurchaseOrder::findById((int)$po['po_id']), 'Purchase order emailed to vendor');
    }

    private function vendorEmail(int $vendorId): string
    {
        $vendor = Vendor::findById($vendorId);
        return trim((string)($vendor['email'] ?? ''));
    }

    /** Render a printable HTML purchase-order document (used for both the PDF response and the email body). */
    private function renderPoDocument(array $po): string
    {
        $rowsHtml = '';
        foreach ($po['items'] as $item) {
            $rowsHtml .= '<tr>'
                . '<td style="padding:6px;border-bottom:1px solid #eee">' . htmlspecialchars((string)$item['description']) . '</td>'
                . '<td style="padding:6px;border-bottom:1px solid #eee">' . htmlspecialchars((string)($item['hsn_code'] ?? '')) . '</td>'
                . '<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">' . htmlspecialchars((string)$item['quantity']) . ' ' . htmlspecialchars((string)$item['unit']) . '</td>'
                . '<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">' . number_format((float)$item['unit_price'], 2) . '</td>'
                . '<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">' . htmlspecialchars((string)$item['gst_rate']) . '%</td>'
                . '<td style="padding:6px;border-bottom:1px solid #eee;text-align:right">' . number_format((float)$item['line_total'], 2) . '</td>'
                . '</tr>';
        }

        return '<div>'
            . '<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><tr>'
            . '<td><h3 style="margin:0">' . htmlspecialchars((string)$po['po_number']) . '</h3>'
            . '<p style="margin:4px 0;color:#666">Date: ' . htmlspecialchars((string)$po['order_date']) . ' &nbsp; Expected: ' . htmlspecialchars((string)($po['expected_date'] ?? '—')) . '</p></td>'
            . '<td style="text-align:right"><b>' . htmlspecialchars((string)$po['vendor_name']) . '</b><br>' . htmlspecialchars((string)($po['vendor_gstin'] ?? '')) . '</td>'
            . '</tr></table>'
            . '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f6f7f9;text-align:left">'
            . '<th style="padding:6px">Item</th><th style="padding:6px">HSN</th><th style="padding:6px;text-align:right">Qty</th>'
            . '<th style="padding:6px;text-align:right">Rate</th><th style="padding:6px;text-align:right">GST</th><th style="padding:6px;text-align:right">Amount</th>'
            . '</tr></thead><tbody>' . $rowsHtml . '</tbody></table>'
            . '<table style="width:100%;margin-top:12px"><tr><td></td><td style="text-align:right;width:220px">'
            . '<p style="margin:2px 0">Subtotal: ' . number_format((float)$po['subtotal'], 2) . '</p>'
            . '<p style="margin:2px 0">Tax: ' . number_format((float)$po['tax_amount'], 2) . '</p>'
            . '<p style="margin:2px 0">Other charges: ' . number_format((float)$po['other_charges'], 2) . '</p>'
            . '<p style="margin:6px 0;font-weight:bold;font-size:16px">Total: ' . number_format((float)$po['total'], 2) . '</p>'
            . '</td></tr></table>'
            . ($po['notes'] ? '<p style="margin-top:12px;color:#666"><b>Notes:</b> ' . htmlspecialchars((string)$po['notes']) . '</p>' : '')
            . ($po['terms_conditions'] ? '<p style="color:#666"><b>Terms:</b> ' . htmlspecialchars((string)$po['terms_conditions']) . '</p>' : '')
            . '</div>';
    }

    private function transition(Request $request, string $from, string $to, string $action): void
    {
        $id = (int)$request->param('id');
        $po = $this->poOrFail($id);
        if ($po['status'] !== $from) {
            Response::error("PO must be {$from} before it can become {$to}", 409);
        }

        PurchaseOrder::transition($id, $to);
        $this->audit($request, $action, 'purchase_orders', $id, ['status' => $from], ['status' => $to]);
        Response::success(PurchaseOrder::findById($id), 'Purchase order status updated');
    }

    private function headerPayload(Request $request, bool $creating): array
    {
        $textFields = [
            'po_number', 'reference_number', 'order_date', 'expected_date', 'shipment_preference',
            'deliver_to_type', 'deliver_to_name', 'deliver_to_address', 'payment_terms',
            'seller_state', 'vendor_state', 'vendor_gstin', 'gst_treatment', 'notes', 'terms_conditions',
        ];
        $provided = $request->only([...$textFields, 'vendor_id', 'pr_id', 'other_charges', 'reverse_charge']);
        $data = $provided;
        foreach ($data as $key => $value) {
            $data[$key] = is_string($value) ? Request::sanitize($value) : $value;
        }
        if ($creating) {
            $companyRow = Database::fetch(
                "SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = 'company_name' LIMIT 1",
                [Database::tenantId()]
            );
            $deliverToName = !empty($companyRow['setting_value']) ? $companyRow['setting_value'] : '';

            $data += [
                'po_number' => '',
                'reference_number' => '',
                'order_date' => date('Y-m-d'),
                'expected_date' => '',
                'shipment_preference' => '',
                'deliver_to_type' => 'organization',
                'deliver_to_name' => $deliverToName,
                'deliver_to_address' => '',
                'payment_terms' => '',
                'seller_state' => '',
                'vendor_state' => '',
                'vendor_gstin' => '',
                'gst_treatment' => '',
                'reverse_charge' => 0,
                'other_charges' => 0,
                'notes' => '',
                'terms_conditions' => '',
                'pr_id' => null,
            ];
        }
        if (isset($data['po_number'])) {
            $data['po_number'] = substr((string)$data['po_number'], 0, 40);
        }
        if ($creating && empty($data['vendor_id'])) {
            Response::error('vendor_id is required', 422);
        }
        if (isset($data['vendor_id']) && !Vendor::findById((int)$data['vendor_id'])) {
            Response::error('Vendor not found', 404);
        }
        if (!empty($data['pr_id'])) {
            $pr = PurchaseRequest::findById((int)$data['pr_id']);
            if (!$pr) {
                Response::error('Purchase request not found', 404);
            }
            if ($creating && $pr['status'] !== 'approved') {
                Response::error('Only approved purchase requests can convert to PO', 409);
            }
        }
        foreach (['order_date', 'expected_date'] as $dateKey) {
            if (($data[$dateKey] ?? '') !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$data[$dateKey])) {
                Response::error("{$dateKey} must be YYYY-MM-DD", 422);
            }
        }
        if (isset($data['other_charges']) && (float)$data['other_charges'] < 0) {
            Response::error('other_charges cannot be negative', 422);
        }
        if (isset($data['reverse_charge'])) {
            $data['reverse_charge'] = filter_var($data['reverse_charge'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        }

        if ($creating && empty($data['vendor_state'])) {
            $vendor = Vendor::findById((int)$data['vendor_id']);
            $data['vendor_state'] = $vendor['state'] ?? '';
            if (empty($data['vendor_gstin'])) {
                $data['vendor_gstin'] = $vendor['gst_number'] ?? $vendor['gstin'] ?? '';
            }
            if (empty($data['payment_terms'])) {
                $data['payment_terms'] = $vendor['payment_terms'] ?? '';
            }
        }

        return $creating ? $data : array_intersect_key($data, $provided);
    }

    private function ensureUniquePoNumber(string $poNumber, ?int $exceptId = null): void
    {
        if (trim($poNumber) === '') {
            Response::error('po_number cannot be empty', 422);
        }
        $sql = 'SELECT po_id FROM purchase_orders WHERE po_number = ? AND tenant_id = ?';
        $params = [$poNumber, Database::tenantId()];
        if ($exceptId !== null) {
            $sql .= ' AND po_id <> ?';
            $params[] = $exceptId;
        }
        $sql .= ' LIMIT 1';
        if (Database::fetch($sql, $params)) {
            Response::error('PO number already exists', 409);
        }
    }

    private function uploadedReceiptPhoto(): ?array
    {
        foreach (['delivery_photo', 'photo', 'document'] as $key) {
            if (isset($_FILES[$key]) && is_array($_FILES[$key]) && (int)($_FILES[$key]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                return $_FILES[$key];
            }
        }
        return null;
    }

    private function itemsPayload(mixed $value, int $prId): array
    {
        if ((!is_array($value) || empty($value)) && $prId > 0) {
            $pr = PurchaseRequest::findById($prId);
            $value = array_map(fn(array $item): array => [
                'description' => $item['description'],
                'product_id' => $item['product_id'],
                'quantity' => $item['quantity'],
                'unit' => $item['unit'],
                'unit_price' => $item['est_unit_price'] ?? 0,
                'gst_rate' => 0,
            ], $pr['items'] ?? []);
        }

        if (!is_array($value) || empty($value)) {
            Response::error('At least one PO item is required', 422);
        }

        $items = [];
        foreach ($value as $index => $item) {
            if (!is_array($item)) {
                Response::error("Item {$index} must be an object", 422);
            }
            $description = trim((string)($item['description'] ?? ''));
            $quantity = (float)($item['quantity'] ?? 0);
            $unitPrice = (float)($item['unit_price'] ?? 0);
            $gstRate = (float)($item['gst_rate'] ?? 0);
            if ($description === '' || $quantity <= 0 || $unitPrice < 0 || $gstRate < 0) {
                Response::error("Item {$index} has invalid description, quantity, price, or GST", 422);
            }
            $productId = isset($item['product_id']) && $item['product_id'] !== '' ? (int)$item['product_id'] : null;
            if ($productId !== null && !Database::fetch('SELECT product_id FROM products WHERE product_id = ? AND tenant_id = ? LIMIT 1', [$productId, Database::tenantId()])) {
                Response::error("Item {$index} product not found", 422);
            }

            $items[] = [
                'description' => substr($description, 0, 255),
                'product_id' => $productId,
                'hsn_code' => substr(trim((string)($item['hsn_code'] ?? '')), 0, 20),
                'quantity' => $quantity,
                'unit' => substr(trim((string)($item['unit'] ?? 'Nos')) ?: 'Nos', 0, 20),
                'unit_price' => $unitPrice,
                'gst_rate' => $gstRate,
                'sort_order' => (int)($item['sort_order'] ?? $index),
            ];
        }

        return $items;
    }

    private function receiptLinesPayload(mixed $value, array $po): array
    {
        if (!is_array($value) || empty($value)) {
            Response::error('At least one receipt item is required', 422);
        }
        $poItems = [];
        foreach ($po['items'] as $item) {
            $poItems[(int)$item['item_id']] = $item;
        }

        $lines = [];
        foreach ($value as $index => $line) {
            if (!is_array($line)) {
                Response::error("Receipt item {$index} must be an object", 422);
            }
            $poItemId = (int)($line['po_item_id'] ?? $line['item_id'] ?? 0);
            $quantity = (float)($line['quantity'] ?? 0);
            if (!isset($poItems[$poItemId])) {
                Response::error("Receipt item {$index} does not belong to this PO", 422);
            }
            if ($quantity <= 0) {
                Response::error("Receipt item {$index} quantity must be greater than 0", 422);
            }
            $outstanding = (float)$poItems[$poItemId]['outstanding_qty'];
            if ($quantity > $outstanding + 0.0005) {
                Response::error("Receipt item {$index} exceeds outstanding quantity {$outstanding}", 409);
            }
            $lines[] = [
                'po_item_id' => $poItemId,
                'product_id' => $poItems[$poItemId]['product_id'],
                'quantity' => $quantity,
                'unit_cost' => (float)$poItems[$poItemId]['unit_price'],
            ];
        }

        return $lines;
    }

    /**
     * Build vendor-bill line items. When the caller doesn't supply items (the
     * existing frontend `bill(id, payment_mode)` call doesn't), default to
     * billing each PO line's received quantity at its PO unit price/GST — this
     * keeps the old one-click "Create bill" button working unchanged while the
     * richer bill builder can now also pass explicit, editable lines.
     */
    private function billItemsPayload(mixed $value, array $po): array
    {
        $poItems = [];
        foreach ($po['items'] as $item) {
            $poItems[(int)$item['item_id']] = $item;
        }

        if (!is_array($value) || empty($value)) {
            $items = [];
            foreach ($poItems as $poItemId => $item) {
                $qty = (float)$item['received_qty'];
                if ($qty <= 0) {
                    continue;
                }
                $items[] = [
                    'po_item_id' => $poItemId,
                    'description' => $item['description'],
                    'product_id' => $item['product_id'],
                    'quantity' => $qty,
                    'unit' => $item['unit'],
                    'unit_price' => (float)$item['unit_price'],
                    'gst_rate' => (float)$item['gst_rate'],
                    'sort_order' => $item['sort_order'],
                ];
            }
            if (empty($items)) {
                Response::error('PO has no received quantity to bill', 409);
            }
            return $items;
        }

        $items = [];
        foreach ($value as $index => $line) {
            if (!is_array($line)) {
                Response::error("Bill item {$index} must be an object", 422);
            }
            $poItemId = isset($line['po_item_id']) && $line['po_item_id'] !== '' ? (int)$line['po_item_id'] : null;
            if ($poItemId !== null && !isset($poItems[$poItemId])) {
                Response::error("Bill item {$index} does not belong to this PO", 422);
            }
            $description = trim((string)($line['description'] ?? ($poItemId !== null ? $poItems[$poItemId]['description'] : '')));
            $quantity = (float)($line['quantity'] ?? 0);
            $unitPrice = (float)($line['unit_price'] ?? ($poItemId !== null ? $poItems[$poItemId]['unit_price'] : 0));
            $gstRate = (float)($line['gst_rate'] ?? ($poItemId !== null ? $poItems[$poItemId]['gst_rate'] : 0));
            if ($description === '' || $quantity <= 0 || $unitPrice < 0) {
                Response::error("Bill item {$index} has invalid description, quantity, or price", 422);
            }
            $items[] = [
                'po_item_id' => $poItemId,
                'description' => substr($description, 0, 255),
                'product_id' => $poItemId !== null ? $poItems[$poItemId]['product_id'] : null,
                'quantity' => $quantity,
                'unit' => substr(trim((string)($line['unit'] ?? ($poItemId !== null ? $poItems[$poItemId]['unit'] : 'Nos'))) ?: 'Nos', 0, 20),
                'unit_price' => $unitPrice,
                'gst_rate' => $gstRate,
                'sort_order' => (int)($line['sort_order'] ?? $index),
            ];
        }

        return $items;
    }

    private function poOrFail(int $id): array
    {
        if ($id <= 0) {
            Response::error('Invalid purchase order ID', 400);
        }
        $po = PurchaseOrder::findById($id);
        if (!$po) {
            Response::error('Purchase order not found', 404);
        }
        return $po;
    }

    private function audit(Request $request, string $action, string $table, int $id, mixed $before, mixed $after): void
    {
        Database::insertTenant('audit_log', [
            'user_id'    => isset($request->user['user_id']) ? (int)$request->user['user_id'] : null,
            'action'     => $action,
            'table_name' => $table,
            'record_id'  => $id,
            'old_value'  => $before !== null ? json_encode($before, JSON_UNESCAPED_UNICODE) : null,
            'new_value'  => $after !== null ? json_encode($after, JSON_UNESCAPED_UNICODE) : null,
            'ip_address' => $request->ip(),
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }
}
