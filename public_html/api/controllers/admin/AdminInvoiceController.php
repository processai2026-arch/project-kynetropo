<?php
declare(strict_types=1);

/**
 * Admin Invoice Controller
 * GET /admin/invoices          — List invoices with filters
 * GET /admin/invoices/{id}     — Get single invoice
 * POST /admin/invoices         — Auto-generate invoice for an order
 * GET /admin/invoices/{id}/download — Stream plain-text invoice (PDF lib not available on shared host)
 */
class AdminInvoiceController
{
    // ─── GET /admin/invoices ──────────────────────────────────────────────────

    public function index(Request $request): void
    {
        $page  = max(1, (int)$request->query('page', 1));
        $limit = min(500, max(1, (int)$request->query('limit', 20)));

        $where  = ['i.tenant_id = ?'];
        $params = [Database::tenantId()];

        if ($orderId = (int)$request->query('order_id')) {
            $where[]  = 'i.order_id = ?';
            $params[] = $orderId;
        }
        if ($userId = (int)$request->query('user_id')) {
            $where[]  = 'o.user_id = ?';
            $params[] = $userId;
        }
        $status = $request->query('status');
        $allStatuses = ['paid', 'Paid', 'unpaid', 'cancelled', 'Cancelled', 'Draft', 'Sent', 'Overdue'];
        if ($status && in_array($status, $allStatuses, true)) {
            $where[]  = 'i.status = ?';
            $params[] = $status;
        }
        if ($from = $request->query('from_date')) {
            $where[]  = 'i.created_at >= ?';
            $params[] = $from . ' 00:00:00';
        }
        if ($to = $request->query('to_date')) {
            $where[]  = 'i.created_at <= ?';
            $params[] = $to . ' 23:59:59';
        }

        $whereClause = implode(' AND ', $where);

        // LEFT JOIN so standalone GST invoices (order_id = NULL) also appear
        $total  = Database::count(
            "SELECT COUNT(*) AS cnt
             FROM invoices i
             LEFT JOIN orders o ON o.order_id = i.order_id AND o.tenant_id = i.tenant_id
             LEFT JOIN users  u ON u.user_id  = o.user_id AND u.tenant_id = i.tenant_id
             WHERE $whereClause",
            $params
        );
        $offset = ($page - 1) * $limit;

        $rows = Database::fetchAll(
            "SELECT i.invoice_id, i.invoice_number, i.order_id,
                    o.order_number,
                    COALESCE(i.customer_name, u.name)              AS customer_name,
                    COALESCE(i.customer_email, u.email)            AS customer_email,
                    COALESCE(i.payment_method, o.payment_method)   AS payment_method,
                    COALESCE(i.customer_gstin, u.gst_number)       AS customer_gstin,
                    COALESCE(i.customer_state, o.delivery_state, u.state) AS customer_state,
                    COALESCE(i.customer_address, o.delivery_address, u.address) AS customer_address,
                    i.customer_city,
                    i.customer_pincode,
                    i.customer_country,
                    COALESCE(i.seller_state, 'Tamil Nadu')         AS seller_state,
                    u.gst_number                                   AS order_customer_gstin,
                    o.order_status,
                    COALESCE(i.payment_status, o.payment_status)   AS payment_status,
                    i.due_date, i.invoice_date, i.payment_terms, i.place_of_supply, i.ship_to, i.subject,
                    i.terms_and_conditions,
                    i.subtotal, i.gst_rate, i.gst_amount,
                    COALESCE(i.cgst_amount, 0)  AS cgst_amount,
                    COALESCE(i.sgst_amount, 0)  AS sgst_amount,
                    COALESCE(i.igst_amount, 0)  AS igst_amount,
                    i.delivery_fee, COALESCE(i.discount, 0) AS discount, i.total,
                    COALESCE(i.amount_paid, 0) AS amount_paid,
                    GREATEST(i.total - COALESCE(i.amount_paid, 0), 0) AS balance_due,
                    i.status, i.notes, i.created_at,
                    i.payment_reminder_sent_at, i.payment_reminder_count,
                    i.irn, i.irn_qr, i.irn_status,
                    (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.invoice_id AND ii.tenant_id = i.tenant_id) AS item_count
             FROM invoices i
             LEFT JOIN orders o ON o.order_id = i.order_id AND o.tenant_id = i.tenant_id
             LEFT JOIN users  u ON u.user_id  = o.user_id AND u.tenant_id = i.tenant_id
             WHERE $whereClause
             ORDER BY i.created_at DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );

        foreach ($rows as &$r) {
            $r['subtotal']     = (float)$r['subtotal'];
            $r['gst_rate']     = (float)($r['gst_rate'] ?? 0);
            $r['gst_amount']   = (float)$r['gst_amount'];
            $r['cgst_amount']  = (float)$r['cgst_amount'];
            $r['sgst_amount']  = (float)$r['sgst_amount'];
            $r['igst_amount']  = (float)$r['igst_amount'];
            $r['delivery_fee'] = (float)$r['delivery_fee'];
            $r['total']        = (float)$r['total'];
            $r['amount_paid']  = (float)$r['amount_paid'];
            $r['balance_due']  = (float)$r['balance_due'];
        }

        Response::paginated($rows, [
            'page'        => $page,
            'limit'       => $limit,
            'total'       => $total,
            'total_pages' => (int)ceil($total / $limit),
        ]);
    }

    // ─── POST /admin/invoices — manually generate invoice for an order ────────

    public function store(Request $request): void
    {
        Validator::make($request->only(['order_id']), [
            'order_id' => 'required|integer',
        ])->validate();

        $orderId = (int)$request->input('order_id');
        if (!Database::fetch('SELECT order_id FROM orders WHERE order_id = ? AND tenant_id = ? LIMIT 1', [$orderId, Database::tenantId()])) {
            Response::error('Order not found', 404);
        }

        $existing = Database::fetch('SELECT invoice_id, invoice_number FROM invoices WHERE order_id = ? AND tenant_id = ? LIMIT 1', [$orderId, Database::tenantId()]);
        if ($existing) {
            Response::error('Invoice already exists for this order: ' . $existing['invoice_number'], 409);
        }

        $invoice = self::generateForOrder($orderId);
        Response::success($invoice, 'Invoice created successfully', 201);
    }

    // ─── Shared helper: create-or-sync an order invoice ─────────────────────
    public static function generateForOrder(int $orderId): ?array
    {
        $existing = Database::fetch(
            'SELECT invoice_id FROM invoices WHERE order_id = ? AND tenant_id = ? LIMIT 1', [$orderId, Database::tenantId()]
        );

        $order = Database::fetch('SELECT * FROM orders WHERE order_id = ? AND tenant_id = ? LIMIT 1', [$orderId, Database::tenantId()]);
        if (!$order) return null;

        // If invoice already exists, sync its status + payment_method with the order
        if ($existing) {
            $newStatus = $order['payment_status'] === 'paid' ? 'Paid' : 'unpaid';
            Database::execute(
                'UPDATE invoices SET status = ?, payment_method = ?, updated_at = NOW()
                 WHERE invoice_id = ? AND tenant_id = ?',
                [$newStatus, $order['payment_method'], $existing['invoice_id'], Database::tenantId()]
            );
            return Database::fetch(
                'SELECT * FROM invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1', [$existing['invoice_id'], Database::tenantId()]
            );
        }

        $gstRate   = (float)(Database::fetch("SELECT setting_value FROM settings WHERE setting_key = 'gst_rate' AND tenant_id = ?", [Database::tenantId()])['setting_value'] ?? 18);
        $prefix    = Database::fetch("SELECT setting_value FROM settings WHERE setting_key = 'invoice_prefix' AND tenant_id = ?", [Database::tenantId()])['setting_value'] ?? 'INV';
        $maxId     = (int)(Database::fetch('SELECT MAX(invoice_id) AS max_id FROM invoices WHERE tenant_id = ?', [Database::tenantId()])['max_id'] ?? 0);
        $invNumber = $prefix . '-' . date('Y') . '-' . str_pad((string)($maxId + 1), 4, '0', STR_PAD_LEFT);

        $subtotal  = (float)$order['total_amount'] - (float)$order['delivery_fee'];
        $gstAmount = round($subtotal * $gstRate / 100, 2);
        $total     = round($subtotal + $gstAmount + (float)$order['delivery_fee'], 2);

        $invoiceId = Database::insert(
            'INSERT INTO invoices (tenant_id, invoice_number, order_id, subtotal, gst_rate, gst_amount, delivery_fee, total, status, payment_method, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [
                Database::tenantId(),
                $invNumber, $orderId, $subtotal, $gstRate, $gstAmount,
                (float)$order['delivery_fee'], $total,
                $order['payment_status'] === 'paid' ? 'Paid' : 'unpaid',
                $order['payment_method'],
            ]
        );

        // ── Populate invoice_items from order_items ──────────────────────────
        $orderItems = Database::fetchAll(
            "SELECT oi.quantity, oi.unit_price,
                    CONCAT(p.product_name, COALESCE(CONCAT(' - ', pc.size), '')) AS description,
                    '' AS hsn_code,
                    oi.item_id AS sort_order
             FROM order_items oi
             JOIN products p ON p.product_id = oi.product_id AND p.tenant_id = oi.tenant_id
             LEFT JOIN product_configurations pc ON pc.config_id = oi.config_id AND pc.tenant_id = oi.tenant_id
             WHERE oi.order_id = ? AND oi.tenant_id = ?",
            [$orderId, Database::tenantId()]
        );

        foreach ($orderItems as $sort => $oi) {
            $qty       = (float)$oi['quantity'];
            $price     = (float)$oi['unit_price'];
            $lineTotal = round($qty * $price, 2);
            Database::insert(
                'INSERT INTO invoice_items (tenant_id, invoice_id, description, hsn_code, quantity, unit_price, gst_rate, line_total, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [Database::tenantId(), $invoiceId, $oi['description'], $oi['hsn_code'], $qty, $price, $gstRate, $lineTotal, $sort + 1]
            );
        }
        // ────────────────────────────────────────────────────────────────────

        return Database::fetch('SELECT * FROM invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1', [$invoiceId, Database::tenantId()]);
    }

    // ─── GET /admin/invoices/{id} — single invoice with line items ──────────
    public function show(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid invoice ID', 400);
        }

        $inv = Database::fetch(
            "SELECT i.*, o.order_number,
                    o.delivery_address, o.delivery_city, o.delivery_state, o.delivery_pincode,
                    u.name AS order_customer_name, u.email AS order_customer_email, u.gst_number AS order_customer_gstin,
                    u.company_name AS order_company_name,
                    u.address AS order_customer_address, u.city AS order_customer_city,
                    u.state AS order_customer_state, u.pincode AS order_customer_pincode
             FROM invoices i
             LEFT JOIN orders o ON o.order_id = i.order_id AND o.tenant_id = i.tenant_id
             LEFT JOIN users  u ON u.user_id  = o.user_id AND u.tenant_id = i.tenant_id
             WHERE i.invoice_id = ? AND i.tenant_id = ? LIMIT 1",
            [$id, Database::tenantId()]
        );
        if (!$inv) {
            Response::error('Invoice not found', 404);
        }

        $items = Database::fetchAll(
            'SELECT item_id, description, hsn_code, quantity, unit, unit_price, gst_rate, line_total, sort_order
             FROM invoice_items WHERE invoice_id = ? AND tenant_id = ? ORDER BY sort_order ASC, item_id ASC',
            [$id, Database::tenantId()]
        );

        // Fallback for order-based invoices without invoice_items rows
        if (empty($items) && !empty($inv['order_id'])) {
            $orderItems = Database::fetchAll(
                "SELECT oi.item_id AS item_id,
                        CONCAT(p.product_name, COALESCE(CONCAT(' - ', pc.size), '')) AS description,
                        '' AS hsn_code,
                        oi.quantity, oi.unit_price, ? AS gst_rate,
                        (oi.quantity * oi.unit_price) AS line_total,
                        oi.item_id AS sort_order
                 FROM order_items oi
                 JOIN products p ON p.product_id = oi.product_id AND p.tenant_id = oi.tenant_id
                 LEFT JOIN product_configurations pc ON pc.config_id = oi.config_id AND pc.tenant_id = oi.tenant_id
                 WHERE oi.order_id = ? AND oi.tenant_id = ?",
                [(float)$inv['gst_rate'], (int)$inv['order_id'], Database::tenantId()]
            );
            foreach ($orderItems as $oi) {
                $items[] = $oi;
            }
        }

        foreach ($items as &$it) {
            $it['quantity']   = (float)$it['quantity'];
            $it['unit_price'] = (float)$it['unit_price'];
            $it['gst_rate']   = (float)$it['gst_rate'];
            $it['line_total'] = (float)$it['line_total'];
        }
        $inv['amount_paid'] = (float)($inv['amount_paid'] ?? 0);
        // Issued credit notes reduce the effective receivable alongside payments.
        // Wrapped defensively: credit_notes only exists once
        // database/create_invoicing_extra.sql has been run.
        try {
            $inv['credited_total'] = self::creditedTotalForInvoice($id);
        } catch (\Throwable $e) {
            $inv['credited_total'] = 0.0;
        }
        $inv['balance_due'] = max(0.0, (float)($inv['total'] ?? 0) - $inv['amount_paid'] - $inv['credited_total']);
        foreach (['subtotal','gst_amount','cgst_amount','sgst_amount','igst_amount','delivery_fee','total','gst_rate'] as $f) {
            if (isset($inv[$f])) $inv[$f] = (float)$inv[$f];
        }
        $inv['customer_name'] = $inv['customer_name'] ?: ($inv['order_customer_name'] ?? null);
        $inv['customer_email'] = $inv['customer_email'] ?: ($inv['order_customer_email'] ?? null);
        $inv['customer_gstin'] = $inv['customer_gstin'] ?: ($inv['order_customer_gstin'] ?? null);
        $inv['customer_state'] = $inv['customer_state']
            ?: ($inv['delivery_state'] ?? null)
            ?: ($inv['order_customer_state'] ?? null);
        $inv['customer_address'] = $inv['customer_address']
            ?: ($inv['delivery_address'] ?? null)
            ?: ($inv['order_customer_address'] ?? null);
        $inv['seller_state'] = $inv['seller_state'] ?: 'Tamil Nadu';
        $inv['items'] = $items;
        Response::success($inv);
    }

    // ─── POST /admin/invoices/gst — standalone GST invoice with line items ──
    public function storeGst(Request $request): void
    {
        $required = ['customer_name', 'customer_state', 'seller_state', 'items'];
        foreach ($required as $key) {
            if (!$request->input($key)) {
                Response::error("`$key` is required", 422);
            }
        }

        $items = $request->input('items');
        if (!is_array($items) || empty($items)) {
            Response::error('`items` must be a non-empty array', 422);
        }

        $customerState = trim((string)$request->input('customer_state'));
        $sellerState   = trim((string)$request->input('seller_state'));
        $interState    = strtolower($customerState) !== strtolower($sellerState);

        $subtotal = 0.0;
        $gstTotal = 0.0;
        $cleanItems = [];
        foreach ($items as $idx => $it) {
            $desc   = trim((string)($it['description'] ?? ''));
            $qty    = (float)($it['quantity']   ?? 0);
            $price  = (float)($it['unit_price'] ?? 0);
            $rate   = (float)($it['gst_rate']   ?? 0);
            $hsn    = trim((string)($it['hsn_code'] ?? ''));
            $unit   = trim((string)($it['unit'] ?? '')) ?: 'Nos';
            if ($desc === '') Response::error("items[$idx].description is required", 422);
            if ($qty   <= 0) Response::error("items[$idx].quantity must be > 0", 422);
            if ($price <  0) Response::error("items[$idx].unit_price cannot be negative", 422);
            if (!in_array((int)$rate, [0, 5, 12, 18, 28], true)) {
                Response::error("items[$idx].gst_rate must be one of 0, 5, 12, 18, 28", 422);
            }
            $lineSub    = round($qty * $price, 2);
            $lineTax    = round($lineSub * $rate / 100, 2);
            $subtotal  += $lineSub;
            $gstTotal  += $lineTax;
            $cleanItems[] = compact('desc', 'qty', 'unit', 'price', 'rate', 'hsn', 'lineSub') + ['sort' => $idx + 1];
        }

        // Discount reduces the taxable value — GST is applied on (subtotal − discount)
        $deliveryFee    = (float)($request->input('delivery_fee') ?? 0);
        $discountAmount = max(0.0, (float)($request->input('discount') ?? 0));
        $taxable        = max(0.0, $subtotal - $discountAmount);
        $discountFactor = $subtotal > 0 ? $taxable / $subtotal : 1.0;
        $adjustedGst    = round($gstTotal * $discountFactor, 2);

        $cgst = $sgst = $igst = 0.0;
        if ($interState) {
            $igst = $adjustedGst;
        } else {
            $cgst = round($adjustedGst / 2, 2);
            $sgst = $adjustedGst - $cgst;
        }
        $total   = round($taxable + $adjustedGst + $deliveryFee);  // round off to whole rupee
        $avgRate = $taxable > 0 ? round(($adjustedGst / $taxable) * 100, 2) : 0;

        $maxId     = (int)(Database::fetch('SELECT MAX(invoice_id) AS max_id FROM invoices WHERE tenant_id = ?', [Database::tenantId()])['max_id'] ?? 0);
        $prefix    = Database::fetch("SELECT setting_value FROM settings WHERE setting_key = 'invoice_prefix' AND tenant_id = ?", [Database::tenantId()])['setting_value'] ?? 'INV';
        $invNumber = $prefix . '-' . date('Y') . '-' . str_pad((string)($maxId + 1), 4, '0', STR_PAD_LEFT);

        Database::beginTransaction();
        try {
            $invoiceId = Database::insert(
                'INSERT INTO invoices
                    (tenant_id, invoice_number, order_id, customer_name, customer_email, customer_gstin, customer_state,
                     customer_address, customer_city, customer_pincode, customer_country,
                     seller_state, due_date, subtotal, gst_rate, gst_amount, cgst_amount, sgst_amount, igst_amount,
                     delivery_fee, discount, total, status, payment_method, payment_status, notes,
                     terms_and_conditions, created_at)
                 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                [
                    Database::tenantId(),
                    $invNumber,
                    Request::sanitize((string)$request->input('customer_name')),
                    $request->input('customer_email') ? strtolower(trim((string)$request->input('customer_email'))) : null,
                    $request->input('customer_gstin') ?: null,
                    $customerState,
                    $request->input('customer_address') ? Request::sanitize((string)$request->input('customer_address')) : null,
                    $request->input('customer_city')    ? Request::sanitize((string)$request->input('customer_city'))    : null,
                    $request->input('customer_pincode') ? trim((string)$request->input('customer_pincode'))              : null,
                    $request->input('customer_country') ? Request::sanitize((string)$request->input('customer_country')) : null,
                    $sellerState,
                    $request->input('due_date') ?: null,
                    $subtotal,
                    $avgRate,
                    $adjustedGst,
                    $cgst, $sgst, $igst,
                    $deliveryFee,
                    $discountAmount,
                    $total,
                    $request->input('status') ?: 'Draft',
                    $request->input('payment_method') ?: null,
                    $request->input('payment_status') ?: 'unpaid',
                    $request->input('notes') ? Request::sanitize((string)$request->input('notes')) : null,
                    $request->input('terms_and_conditions') ? Request::sanitize((string)$request->input('terms_and_conditions')) : null,
                ]
            );

            foreach ($cleanItems as $it) {
                Database::insert(
                    'INSERT INTO invoice_items (tenant_id, invoice_id, description, hsn_code, quantity, unit, unit_price, gst_rate, line_total, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [Database::tenantId(), $invoiceId, $it['desc'], $it['hsn'] ?: null, $it['qty'], $it['unit'], $it['price'], $it['rate'], $it['lineSub'], $it['sort']]
                );
            }
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollback();
            Response::error('Failed to create invoice: ' . $e->getMessage(), 500);
        }

        $created = Database::fetch('SELECT * FROM invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1', [$invoiceId, Database::tenantId()]);
        Response::success($created, 'GST invoice created successfully', 201);
    }

    // ─── PUT /admin/invoices/{id} — update header fields + optional line items ─
    public function update(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid invoice ID', 400);
        }
        $existing = Database::fetch(
            'SELECT invoice_id, customer_state, seller_state FROM invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
        if (!$existing) {
            Response::error('Invoice not found', 404);
        }

        $allowed = ['customer_name', 'customer_email', 'customer_gstin', 'customer_state',
                    'customer_address', 'customer_city', 'customer_pincode', 'customer_country',
                    'seller_state', 'due_date', 'delivery_fee', 'discount', 'status', 'payment_method', 'payment_status', 'notes',
                    'invoice_number', 'invoice_date', 'payment_terms', 'place_of_supply', 'ship_to', 'subject',
                    'terms_and_conditions'];
        $sets   = [];
        $params = [];
        foreach ($allowed as $col) {
            $val = $request->input($col);
            if ($val === null) continue;
            if ($col === 'status') {
                $ok = ['Draft','Sent','Paid','Overdue','Cancelled','unpaid','paid','cancelled'];
                if (!in_array((string)$val, $ok, true)) {
                    Response::error('Invalid status; must be one of: ' . implode(', ', $ok), 422);
                }
            }
            // Empty date strings must become NULL, not '' (invalid DATE)
            if (($col === 'invoice_date' || $col === 'due_date') && trim((string)$val) === '') {
                $sets[]   = "$col = NULL";
                continue;
            }
            $sets[]   = "$col = ?";
            $params[] = in_array($col, ['customer_name','customer_address','notes','ship_to','subject','place_of_supply','terms_and_conditions'], true)
                ? Request::sanitize((string)$val) : $val;
        }

        // ── Optional: replace line items and recompute invoice amounts ─────────
        $newItems   = $request->input('items');
        $hasItems   = is_array($newItems) && !empty($newItems);
        $cleanItems = [];

        if ($hasItems) {
            foreach ($newItems as $idx => $it) {
                $desc  = trim((string)($it['description'] ?? ''));
                $qty   = (float)($it['quantity']   ?? 0);
                $price = (float)($it['unit_price'] ?? 0);
                $rate  = (float)($it['gst_rate']   ?? 0);
                $hsn   = trim((string)($it['hsn_code'] ?? ''));
                $unit  = trim((string)($it['unit'] ?? '')) ?: 'Nos';
                if ($desc === '') Response::error("items[$idx].description is required", 422);
                if ($qty   <= 0) Response::error("items[$idx].quantity must be > 0", 422);
                if ($price <  0) Response::error("items[$idx].unit_price cannot be negative", 422);
                if (!in_array((int)$rate, [0, 5, 12, 18, 28], true)) {
                    Response::error("items[$idx].gst_rate must be one of 0, 5, 12, 18, 28", 422);
                }
                $lineSub      = round($qty * $price, 2);
                $cleanItems[] = compact('desc', 'qty', 'unit', 'price', 'rate', 'hsn', 'lineSub') + ['sort' => $idx + 1];
            }

            // Determine inter/intra state (prefer newly submitted state values)
            $customerState = $request->input('customer_state') ?? $existing['customer_state'] ?? 'Tamil Nadu';
            $sellerState   = $request->input('seller_state')   ?? $existing['seller_state']   ?? 'Tamil Nadu';
            $interState    = strtolower((string)$customerState) !== strtolower((string)$sellerState);

            $subtotal = $gstTotal = 0.0;
            foreach ($cleanItems as $it) {
                $subtotal += $it['lineSub'];
                $gstTotal += round($it['lineSub'] * $it['rate'] / 100, 2);
            }

            $existingFull    = Database::fetch('SELECT delivery_fee, discount FROM invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
            $deliveryFee     = $request->input('delivery_fee') !== null
                ? (float)$request->input('delivery_fee')
                : (float)($existingFull['delivery_fee'] ?? 0);
            $discountAmount  = $request->input('discount') !== null
                ? max(0.0, (float)$request->input('discount'))
                : (float)($existingFull['discount'] ?? 0);

            // GST applied on taxable amount (subtotal − discount)
            $taxable         = max(0.0, $subtotal - $discountAmount);
            $discountFactor  = $subtotal > 0 ? $taxable / $subtotal : 1.0;
            $adjustedGst     = round($gstTotal * $discountFactor, 2);

            $cgst = $sgst = $igst = 0.0;
            if ($interState) $igst = $adjustedGst;
            else { $cgst = round($adjustedGst / 2, 2); $sgst = $adjustedGst - $cgst; }

            $total   = round($taxable + $adjustedGst + $deliveryFee);  // round off to whole rupee
            $avgRate = $taxable > 0 ? round(($adjustedGst / $taxable) * 100, 2) : 0;

            $sets[] = 'subtotal = ?';    $params[] = $subtotal;
            $sets[] = 'gst_rate = ?';    $params[] = $avgRate;
            $sets[] = 'gst_amount = ?';  $params[] = $adjustedGst;
            $sets[] = 'cgst_amount = ?'; $params[] = $cgst;
            $sets[] = 'sgst_amount = ?'; $params[] = $sgst;
            $sets[] = 'igst_amount = ?'; $params[] = $igst;
            $sets[] = 'total = ?';       $params[] = $total;
        }

        if (empty($sets)) {
            Response::error('Provide at least one field to update', 400);
        }

        $sets[]   = 'updated_at = NOW()';
        $params[] = $id;
        $params[] = Database::tenantId();

        if ($hasItems) {
            Database::beginTransaction();
            try {
                Database::execute('UPDATE invoices SET ' . implode(', ', $sets) . ' WHERE invoice_id = ? AND tenant_id = ?', $params);
                Database::execute('DELETE FROM invoice_items WHERE invoice_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
                foreach ($cleanItems as $it) {
                    Database::insert(
                        'INSERT INTO invoice_items (tenant_id, invoice_id, description, hsn_code, quantity, unit, unit_price, gst_rate, line_total, sort_order)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [Database::tenantId(), $id, $it['desc'], $it['hsn'] ?: null, $it['qty'], $it['unit'], $it['price'], $it['rate'], $it['lineSub'], $it['sort']]
                    );
                }
                Database::commit();
            } catch (\Throwable $e) {
                Database::rollback();
                Response::error('Failed to update invoice: ' . $e->getMessage(), 500);
            }
        } else {
            Database::execute('UPDATE invoices SET ' . implode(', ', $sets) . ' WHERE invoice_id = ? AND tenant_id = ?', $params);
        }

        $row = Database::fetch('SELECT * FROM invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        Response::success($row, 'Invoice updated successfully');
    }

    // ─── DELETE /admin/invoices/{id} ─────────────────────────────────────────
    public function destroy(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid invoice ID', 400);
        }
        $existing = Database::fetch('SELECT invoice_id FROM invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        if (!$existing) {
            Response::error('Invoice not found', 404);
        }
        Database::execute('DELETE FROM invoices WHERE invoice_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        Response::success(null, 'Invoice deleted successfully');
    }

    // ─── GET /admin/invoices/{id}/download ───────────────────────────────────
    //
    // No PDF library is available on this shared host (no composer/vendor dir —
    // verified: no dompdf/mpdf/tcpdf present). Rather than the previous plain-text
    // dump (which omitted HSN, CGST/SGST/IGST split, place of supply, ship-to,
    // and terms & conditions), this now renders a complete, self-contained,
    // print-ready HTML document carrying every header/line/tax/total/T&C field
    // that the on-screen / client PDF shows. It opens directly in a browser and
    // can be printed to PDF there (browser "Print → Save as PDF"), giving API
    // consumers a coherent, complete document without a server PDF dependency.
    public function download(Request $request): void
    {
        $invoiceId = (int)$request->param('id');
        $invoice   = Database::fetch(
            'SELECT i.*,
                    o.order_number, o.delivery_address, o.delivery_city, o.delivery_state, o.delivery_pincode,
                    COALESCE(i.customer_name, u.name)    AS customer_name,
                    COALESCE(i.customer_gstin, u.gst_number) AS gst_number,
                    u.email, u.phone, u.company_name
             FROM invoices i
             LEFT JOIN orders o ON o.order_id = i.order_id AND o.tenant_id = i.tenant_id
             LEFT JOIN users  u ON u.user_id  = o.user_id AND u.tenant_id = i.tenant_id
             WHERE i.invoice_id = ? AND i.tenant_id = ? LIMIT 1',
            [$invoiceId, Database::tenantId()]
        );

        if (!$invoice) {
            Response::error('Invoice not found', 404);
        }

        $settings = [];
        $rows = Database::fetchAll('SELECT setting_key, setting_value FROM settings WHERE tenant_id = ?', [Database::tenantId()]);
        foreach ($rows as $row) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }

        $items = Database::fetchAll(
            'SELECT description, hsn_code, quantity, unit, unit_price, gst_rate, line_total
             FROM invoice_items WHERE invoice_id = ? AND tenant_id = ? ORDER BY sort_order ASC, item_id ASC',
            [$invoiceId, Database::tenantId()]
        );

        // Fallback for order-based invoices without invoice_items rows (mirrors show())
        if (empty($items) && !empty($invoice['order_id'])) {
            $items = Database::fetchAll(
                "SELECT CONCAT(p.product_name, COALESCE(CONCAT(' - ', pc.size), '')) AS description,
                        '' AS hsn_code, oi.quantity, 'Nos' AS unit, oi.unit_price, ? AS gst_rate,
                        (oi.quantity * oi.unit_price) AS line_total
                 FROM order_items oi
                 JOIN products p ON p.product_id = oi.product_id AND p.tenant_id = oi.tenant_id
                 LEFT JOIN product_configurations pc ON pc.config_id = oi.config_id AND pc.tenant_id = oi.tenant_id
                 WHERE oi.order_id = ? AND oi.tenant_id = ?",
                [(float)$invoice['gst_rate'], (int)$invoice['order_id'], Database::tenantId()]
            );
        }

        $billToAddress = $invoice['customer_address'] ?: $invoice['delivery_address'] ?: '';
        $billToParts = array_filter([
            $billToAddress,
            $invoice['customer_city'] ?? $invoice['delivery_city'] ?? null,
            $invoice['customer_pincode'] ?? $invoice['delivery_pincode'] ?? null,
            $invoice['customer_country'] ?? null,
        ]);
        $shipTo = trim((string)($invoice['ship_to'] ?? '')) ?: implode(', ', $billToParts);

        $cgst = (float)($invoice['cgst_amount'] ?? 0);
        $sgst = (float)($invoice['sgst_amount'] ?? 0);
        $igst = (float)($invoice['igst_amount'] ?? 0);
        $amountPaid = (float)($invoice['amount_paid'] ?? 0);
        $balanceDue = max(0.0, (float)$invoice['total'] - $amountPaid);

        $termsAndConditions = trim((string)($invoice['terms_and_conditions'] ?? ''));
        $termsList = $termsAndConditions !== ''
            ? array_values(array_filter(array_map('trim', explode("\n", $termsAndConditions))))
            : [];

        $h = static fn($v) => htmlspecialchars((string)($v ?? ''), ENT_QUOTES, 'UTF-8');
        $money = static fn($v) => '&#8377;' . number_format((float)$v, 2);

        $itemRows = '';
        $sn = 0;
        foreach ($items as $it) {
            $sn++;
            $itemRows .= '<tr>'
                . '<td class="num">' . $sn . '</td>'
                . '<td>' . $h($it['description']) . '</td>'
                . '<td class="num">' . $h($it['hsn_code'] ?: '—') . '</td>'
                . '<td class="num">' . $h($it['quantity']) . ' ' . $h($it['unit'] ?? 'Nos') . '</td>'
                . '<td class="num">' . $money($it['unit_price']) . '</td>'
                . '<td class="num">' . $h($it['gst_rate']) . '%</td>'
                . '<td class="num">' . $money($it['line_total']) . '</td>'
                . '</tr>';
        }
        if ($itemRows === '') {
            $itemRows = '<tr><td colspan="7" class="empty">No line items</td></tr>';
        }

        $termsHtml = '';
        if ($termsList) {
            $termsHtml = '<ol class="terms">';
            foreach ($termsList as $t) {
                $termsHtml .= '<li>' . $h($t) . '</li>';
            }
            $termsHtml .= '</ol>';
        }

        $statusClass = strtolower((string)($invoice['status'] ?? 'draft'));
        $html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
            . '<title>Invoice ' . $h($invoice['invoice_number']) . '</title>'
            . '<style>
                body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:13px;margin:32px;}
                .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #16a34a;padding-bottom:12px;margin-bottom:16px;}
                .company-name{font-size:20px;font-weight:700;color:#16a34a;margin:0 0 4px;}
                .muted{color:#6b7280;}
                .invoice-title{font-size:22px;font-weight:700;text-align:right;margin:0;}
                .meta-table{margin-top:6px;font-size:12px;text-align:right;}
                .meta-table td{padding:1px 0 1px 12px;}
                .meta-table .label{color:#6b7280;text-align:right;padding-right:6px;}
                .addresses{display:flex;justify-content:space-between;gap:24px;margin:18px 0;}
                .addr-block{flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;}
                .addr-block h4{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;}
                table.items{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;}
                table.items th{background:#f0fdf4;border:1px solid #d1d5db;padding:6px 8px;text-align:left;font-size:11px;text-transform:uppercase;color:#374151;}
                table.items td{border:1px solid #e5e7eb;padding:6px 8px;}
                table.items td.num,table.items th.num{text-align:right;}
                table.items td.empty{text-align:center;color:#9ca3af;padding:18px;}
                .totals{width:320px;margin-left:auto;margin-top:14px;font-size:13px;}
                .totals tr td{padding:3px 0;}
                .totals tr td:last-child{text-align:right;font-weight:600;}
                .totals tr.grand td{border-top:2px solid #1f2937;font-size:15px;font-weight:700;padding-top:6px;}
                .status-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;background:#f0fdf4;color:#15803d;}
                .status-pill.overdue,.status-pill.cancelled{background:#fef2f2;color:#b91c1c;}
                .status-pill.sent,.status-pill.unpaid,.status-pill.draft{background:#fffbeb;color:#b45309;}
                .section{margin-top:18px;}
                .section h4{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;margin:0 0 6px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;}
                .terms{margin:0;padding-left:18px;font-size:11.5px;color:#374151;}
                .terms li{margin-bottom:4px;}
                .footer{margin-top:28px;text-align:center;color:#6b7280;font-size:11.5px;}
              </style></head><body>'
            . '<div class="header">'
            .   '<div>'
            .     '<p class="company-name">' . $h($settings['company_name'] ?? 'Your Company') . '</p>'
            .     '<p class="muted">' . nl2br($h($settings['company_address'] ?? '')) . '</p>'
            .     ($settings['gstin'] ?? '' ? '<p class="muted">GSTIN: ' . $h($settings['gstin']) . '</p>' : '')
            .     ($settings['contact_phone'] ?? '' ? '<p class="muted">Phone: ' . $h($settings['contact_phone']) . '</p>' : '')
            .   '</div>'
            .   '<div>'
            .     '<p class="invoice-title">TAX INVOICE</p>'
            .     '<table class="meta-table"><tbody>'
            .       '<tr><td class="label">Invoice #</td><td>' . $h($invoice['invoice_number']) . '</td></tr>'
            .       ($invoice['order_number'] ? '<tr><td class="label">Order #</td><td>' . $h($invoice['order_number']) . '</td></tr>' : '')
            .       '<tr><td class="label">Invoice Date</td><td>' . $h(date('d-M-Y', strtotime($invoice['invoice_date'] ?: $invoice['created_at']))) . '</td></tr>'
            .       ($invoice['due_date'] ? '<tr><td class="label">Due Date</td><td>' . $h(date('d-M-Y', strtotime($invoice['due_date']))) . '</td></tr>' : '')
            .       ($invoice['place_of_supply'] ? '<tr><td class="label">Place of Supply</td><td>' . $h($invoice['place_of_supply']) . '</td></tr>' : '')
            .       ($invoice['payment_terms'] ? '<tr><td class="label">Payment Terms</td><td>' . $h($invoice['payment_terms']) . '</td></tr>' : '')
            .       '<tr><td class="label">Status</td><td><span class="status-pill ' . $h($statusClass) . '">' . $h($invoice['status']) . '</span></td></tr>'
            .     '</tbody></table>'
            .   '</div>'
            . '</div>'
            . ($invoice['subject'] ? '<p><strong>Subject:</strong> ' . $h($invoice['subject']) . '</p>' : '')
            . '<div class="addresses">'
            .   '<div class="addr-block"><h4>Bill To</h4>'
            .     '<p><strong>' . $h($invoice['customer_name']) . '</strong></p>'
            .     ($invoice['company_name'] ? '<p>' . $h($invoice['company_name']) . '</p>' : '')
            .     ($billToAddress || $billToParts ? '<p>' . $h(implode(', ', $billToParts)) . '</p>' : '')
            .     ($invoice['gst_number'] ? '<p>GSTIN: ' . $h($invoice['gst_number']) . '</p>' : '')
            .     ($invoice['email'] ? '<p>' . $h($invoice['email']) . '</p>' : '')
            .     ($invoice['phone'] ? '<p>' . $h($invoice['phone']) . '</p>' : '')
            .   '</div>'
            .   '<div class="addr-block"><h4>Ship To</h4><p>' . nl2br($h($shipTo ?: '—')) . '</p></div>'
            . '</div>'
            . '<table class="items"><thead><tr>'
            .   '<th class="num">#</th><th>Description</th><th class="num">HSN/SAC</th>'
            .   '<th class="num">Qty</th><th class="num">Rate</th><th class="num">GST</th><th class="num">Amount</th>'
            . '</tr></thead><tbody>' . $itemRows . '</tbody></table>'
            . '<table class="totals"><tbody>'
            .   '<tr><td>Subtotal</td><td>' . $money($invoice['subtotal']) . '</td></tr>'
            .   ($igst > 0
                  ? '<tr><td>IGST</td><td>' . $money($igst) . '</td></tr>'
                  : (($cgst > 0 || $sgst > 0)
                      ? '<tr><td>CGST</td><td>' . $money($cgst) . '</td></tr><tr><td>SGST</td><td>' . $money($sgst) . '</td></tr>'
                      : '<tr><td>GST (' . $h($invoice['gst_rate']) . '%)</td><td>' . $money($invoice['gst_amount']) . '</td></tr>'))
            .   ((float)($invoice['discount'] ?? 0) > 0 ? '<tr><td>Discount</td><td>&minus; ' . $money($invoice['discount']) . '</td></tr>' : '')
            .   ((float)$invoice['delivery_fee'] > 0 ? '<tr><td>Delivery Fee</td><td>' . $money($invoice['delivery_fee']) . '</td></tr>' : '')
            .   '<tr class="grand"><td>Total</td><td>' . $money($invoice['total']) . '</td></tr>'
            .   '<tr><td>Amount Paid</td><td>' . $money($amountPaid) . '</td></tr>'
            .   '<tr><td>Balance Due</td><td>' . $money($balanceDue) . '</td></tr>'
            . '</tbody></table>'
            . ($invoice['notes'] ? '<div class="section"><h4>Notes</h4><p>' . nl2br($h($invoice['notes'])) . '</p></div>' : '')
            . ($termsHtml ? '<div class="section"><h4>Terms &amp; Conditions</h4>' . $termsHtml . '</div>' : '')
            . '<p class="footer">Thank you for your business!</p>'
            . '</body></html>';

        header('Content-Type: text/html; charset=UTF-8');
        header('Content-Disposition: inline; filename="' . $invoice['invoice_number'] . '.html"');
        header('Content-Length: ' . strlen($html));
        echo $html;
        exit;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ─── RECURRING INVOICES + PAYMENT REMINDERS ─────────────────────────────

    private const RECURRING_FREQUENCIES = ['weekly', 'monthly', 'quarterly'];

    // GET /admin/invoices/recurring
    public function recurringIndex(Request $request): void
    {
        $rows = Database::fetchAll(
            "SELECT rit.*,
                    (SELECT COUNT(*) FROM recurring_invoice_runs rir
                     WHERE rir.template_id = rit.template_id AND rir.tenant_id = rit.tenant_id
                       AND rir.status = 'generated') AS generated_count
             FROM recurring_invoice_templates rit
             WHERE rit.tenant_id = ?
             ORDER BY rit.active DESC, rit.next_run_date ASC, rit.template_id DESC",
            [Database::tenantId()]
        );
        foreach ($rows as &$row) {
            $row['active'] = (bool)$row['active'];
            $row['delivery_fee'] = (float)$row['delivery_fee'];
            $row['discount'] = (float)$row['discount'];
            $row['items'] = Database::fetchAll(
                'SELECT item_id, description, hsn_code, quantity, unit, unit_price, gst_rate, sort_order
                 FROM recurring_invoice_template_items
                 WHERE template_id = ? AND tenant_id = ? ORDER BY sort_order, item_id',
                [(int)$row['template_id'], Database::tenantId()]
            );
            foreach ($row['items'] as &$item) {
                foreach (['quantity', 'unit_price', 'gst_rate'] as $field) {
                    $item[$field] = (float)$item[$field];
                }
            }
        }
        Response::success($rows);
    }

    // POST /admin/invoices/recurring
    public function recurringStore(Request $request): void
    {
        $name = trim((string)$request->input('template_name'));
        $customer = trim((string)$request->input('customer_name'));
        $state = trim((string)$request->input('customer_state'));
        $frequency = strtolower(trim((string)$request->input('frequency')));
        $nextRun = trim((string)$request->input('next_run_date'));
        if ($name === '' || $customer === '' || $state === '' || !$this->validDate($nextRun)) {
            Response::error('template_name, customer_name, customer_state, and a valid next_run_date are required', 422);
        }
        if (!in_array($frequency, self::RECURRING_FREQUENCIES, true)) {
            Response::error('frequency must be weekly, monthly, or quarterly', 422);
        }
        $email = strtolower(trim((string)$request->input('customer_email')));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('customer_email must be valid', 422);
        }
        $items = $this->cleanRecurringItems($request->input('items'));

        Database::beginTransaction();
        try {
            $id = Database::insertTenant('recurring_invoice_templates', [
                'template_name' => Request::sanitize($name),
                'customer_name' => Request::sanitize($customer),
                'customer_email' => $email ?: null,
                'customer_gstin' => trim((string)$request->input('customer_gstin')) ?: null,
                'customer_state' => Request::sanitize($state),
                'customer_address' => $request->input('customer_address') ? Request::sanitize((string)$request->input('customer_address')) : null,
                'seller_state' => Request::sanitize(trim((string)$request->input('seller_state')) ?: 'Tamil Nadu'),
                'frequency' => $frequency,
                'next_run_date' => $nextRun,
                'due_days' => min(365, max(0, (int)$request->input('due_days', 0))),
                'delivery_fee' => max(0.0, (float)$request->input('delivery_fee', 0)),
                'discount' => max(0.0, (float)$request->input('discount', 0)),
                'notes' => $request->input('notes') ? Request::sanitize((string)$request->input('notes')) : null,
                'terms_and_conditions' => $request->input('terms_and_conditions') ? Request::sanitize((string)$request->input('terms_and_conditions')) : null,
                'active' => $request->input('active') === null || (bool)$request->input('active') ? 1 : 0,
                'created_by' => $request->user['user_id'] ?? null,
            ]);
            $this->insertRecurringItems($id, $items);
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to create recurring template: ' . $e->getMessage(), 500);
        }
        Response::success(
            Database::fetch('SELECT * FROM recurring_invoice_templates WHERE template_id = ? AND tenant_id = ?', [$id, Database::tenantId()]),
            'Recurring invoice template created',
            201
        );
    }

    // PUT /admin/invoices/recurring/{id}
    public function recurringUpdate(Request $request): void
    {
        $id = (int)$request->param('id');
        if (!Database::fetch('SELECT template_id FROM recurring_invoice_templates WHERE template_id = ? AND tenant_id = ?', [$id, Database::tenantId()])) {
            Response::error('Recurring invoice template not found', 404);
        }
        $sets = [];
        $params = [];
        foreach (['template_name','customer_name','customer_email','customer_gstin','customer_state','customer_address','seller_state','frequency','next_run_date','due_days','delivery_fee','discount','notes','terms_and_conditions','active'] as $column) {
            $value = $request->input($column);
            if ($value === null) continue;
            if ($column === 'frequency' && !in_array(strtolower((string)$value), self::RECURRING_FREQUENCIES, true)) {
                Response::error('frequency must be weekly, monthly, or quarterly', 422);
            }
            if ($column === 'next_run_date' && !$this->validDate((string)$value)) {
                Response::error('next_run_date must use YYYY-MM-DD', 422);
            }
            if ($column === 'customer_email' && trim((string)$value) !== '' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                Response::error('customer_email must be valid', 422);
            }
            if ($column === 'active') $value = (bool)$value ? 1 : 0;
            if ($column === 'due_days') $value = min(365, max(0, (int)$value));
            if (in_array($column, ['delivery_fee','discount'], true)) $value = max(0.0, (float)$value);
            if ($column === 'customer_email') $value = strtolower(trim((string)$value)) ?: null;
            if (in_array($column, ['template_name','customer_name','customer_state','customer_address','seller_state','notes','terms_and_conditions'], true)) {
                $value = Request::sanitize((string)$value);
            }
            $sets[] = "$column = ?";
            $params[] = $value;
        }
        $submittedItems = $request->input('items');
        $replaceItems = is_array($submittedItems);
        $items = $replaceItems ? $this->cleanRecurringItems($submittedItems) : [];
        if (!$sets && !$replaceItems) Response::error('Provide at least one field to update', 400);

        Database::beginTransaction();
        try {
            if ($sets) {
                Database::execute(
                    'UPDATE recurring_invoice_templates SET ' . implode(', ', $sets) . ', updated_at = NOW() WHERE template_id = ? AND tenant_id = ?',
                    [...$params, $id, Database::tenantId()]
                );
            }
            if ($replaceItems) {
                Database::execute('DELETE FROM recurring_invoice_template_items WHERE template_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
                $this->insertRecurringItems($id, $items);
            }
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Failed to update recurring template: ' . $e->getMessage(), 500);
        }
        Response::success(
            Database::fetch('SELECT * FROM recurring_invoice_templates WHERE template_id = ? AND tenant_id = ?', [$id, Database::tenantId()]),
            'Recurring invoice template updated'
        );
    }

    // POST /admin/invoices/recurring/generate-due
    public function recurringGenerateDue(Request $request): void
    {
        $through = trim((string)($request->input('through_date') ?: date('Y-m-d')));
        if (!$this->validDate($through)) Response::error('through_date must use YYYY-MM-DD', 422);
        $templates = Database::fetchAll(
            'SELECT * FROM recurring_invoice_templates WHERE tenant_id = ? AND active = 1 AND next_run_date <= ? ORDER BY next_run_date, template_id',
            [Database::tenantId(), $through]
        );
        $generated = [];
        $failures = [];
        $attempts = 0;
        foreach ($templates as $template) {
            $runDate = (string)$template['next_run_date'];
            while ($runDate <= $through && $attempts++ < 200) {
                $prior = Database::fetch(
                    'SELECT run_id, status FROM recurring_invoice_runs WHERE tenant_id = ? AND template_id = ? AND scheduled_for = ?',
                    [Database::tenantId(), (int)$template['template_id'], $runDate]
                );
                if ($prior && $prior['status'] === 'generated') {
                    $runDate = $this->advanceRecurringDate($runDate, (string)$template['frequency']);
                    continue;
                }
                try {
                    Database::beginTransaction();
                    $runId = $prior
                        ? (int)$prior['run_id']
                        : Database::insertTenant('recurring_invoice_runs', [
                            'template_id' => (int)$template['template_id'],
                            'scheduled_for' => $runDate,
                            'status' => 'processing',
                        ]);
                    if ($prior) {
                        Database::execute("UPDATE recurring_invoice_runs SET status = 'processing', error_message = NULL WHERE run_id = ? AND tenant_id = ?", [$runId, Database::tenantId()]);
                    }
                    $items = Database::fetchAll(
                        'SELECT * FROM recurring_invoice_template_items WHERE template_id = ? AND tenant_id = ? ORDER BY sort_order, item_id',
                        [(int)$template['template_id'], Database::tenantId()]
                    );
                    if (!$items) throw new \RuntimeException('Template has no line items');
                    $invoice = $this->createRecurringInvoice($template, $items, $runDate);
                    Database::execute(
                        "UPDATE recurring_invoice_runs SET invoice_id = ?, status = 'generated', completed_at = NOW() WHERE run_id = ? AND tenant_id = ?",
                        [(int)$invoice['invoice_id'], $runId, Database::tenantId()]
                    );
                    $nextRun = $this->advanceRecurringDate($runDate, (string)$template['frequency']);
                    Database::execute(
                        'UPDATE recurring_invoice_templates SET next_run_date = ?, last_run_at = NOW(), updated_at = NOW() WHERE template_id = ? AND tenant_id = ?',
                        [$nextRun, (int)$template['template_id'], Database::tenantId()]
                    );
                    Database::commit();
                    $generated[] = $invoice;
                    $runDate = $nextRun;
                } catch (\Throwable $e) {
                    if (Database::getInstance()->inTransaction()) Database::rollBack();
                    Database::execute(
                        "INSERT INTO recurring_invoice_runs (tenant_id, template_id, scheduled_for, status, error_message, completed_at)
                         VALUES (?, ?, ?, 'failed', ?, NOW())
                         ON DUPLICATE KEY UPDATE status = 'failed', error_message = VALUES(error_message), completed_at = NOW()",
                        [Database::tenantId(), (int)$template['template_id'], $runDate, substr($e->getMessage(), 0, 500)]
                    );
                    $failures[] = ['template_id' => (int)$template['template_id'], 'scheduled_for' => $runDate, 'error' => $e->getMessage()];
                    break;
                }
            }
        }
        Response::success([
            'through_date' => $through,
            'generated_count' => count($generated),
            'failed_count' => count($failures),
            'invoices' => $generated,
            'failures' => $failures,
        ], $failures ? 'Due invoice generation completed with errors' : 'Due invoices generated');
    }

    // POST /admin/invoices/{id}/reminders
    public function sendPaymentReminder(Request $request): void
    {
        $id = (int)$request->param('id');
        $invoice = Database::fetch(
            "SELECT i.invoice_id, i.invoice_number, i.customer_name, i.customer_email, i.due_date, i.total,
                    COALESCE(i.amount_paid, 0) AS amount_paid, COALESCE(i.payment_status, i.status) AS payment_status,
                    u.name AS order_customer_name, u.email AS order_customer_email
             FROM invoices i
             LEFT JOIN orders o ON o.order_id = i.order_id AND o.tenant_id = i.tenant_id
             LEFT JOIN users u ON u.user_id = o.user_id AND u.tenant_id = i.tenant_id
             WHERE i.invoice_id = ? AND i.tenant_id = ? LIMIT 1",
            [$id, Database::tenantId()]
        );
        if (!$invoice) Response::error('Invoice not found', 404);
        try {
            $credited = self::creditedTotalForInvoice($id);
        } catch (\Throwable $e) {
            $credited = 0.0;
        }
        $balance = max(0.0, (float)$invoice['total'] - (float)$invoice['amount_paid'] - $credited);
        if ($balance <= 0 || strtolower((string)$invoice['payment_status']) === 'paid') {
            Response::error('This invoice has no outstanding balance', 422);
        }
        if (!$invoice['due_date'] || (string)$invoice['due_date'] >= date('Y-m-d')) {
            Response::error('Payment reminders can only be sent for overdue invoices', 422);
        }
        $recipient = strtolower(trim((string)($request->input('email') ?: $invoice['customer_email'] ?: $invoice['order_customer_email'])));
        if (!filter_var($recipient, FILTER_VALIDATE_EMAIL)) Response::error('A valid customer email is required', 422);
        $customer = $invoice['customer_name'] ?: $invoice['order_customer_name'] ?: 'Customer';
        $subject = trim((string)$request->input('subject')) ?: 'Payment reminder for invoice ' . $invoice['invoice_number'];
        $message = trim((string)$request->input('message'));
        $h = static fn($value) => htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
        $body = '<p>Dear ' . $h($customer) . ',</p>'
            . '<p>Invoice <strong>' . $h($invoice['invoice_number']) . '</strong> was due on <strong>'
            . $h(date('d M Y', strtotime((string)$invoice['due_date']))) . '</strong>.</p>'
            . '<p>Outstanding amount: <strong>&#8377;' . number_format($balance, 2) . '</strong></p>'
            . ($message !== '' ? '<p>' . nl2br($h($message)) . '</p>' : '')
            . '<p>Please arrange payment or contact our accounts team if payment has already been made.</p>';
        $sent = Mailer::send($recipient, $subject, Mailer::layout('Payment Reminder', $body));
        Database::insertTenant('invoice_payment_reminders', [
            'invoice_id' => $id,
            'recipient_email' => $recipient,
            'subject' => Request::sanitize($subject),
            'delivery_status' => $sent ? 'sent' : 'failed',
            'sent_at' => $sent ? date('Y-m-d H:i:s') : null,
            'created_by' => $request->user['user_id'] ?? null,
        ]);
        if (!$sent) Response::error('Mailer is disabled or the reminder could not be delivered', 503);
        Database::execute(
            'UPDATE invoices SET customer_email = COALESCE(customer_email, ?), payment_reminder_sent_at = NOW(),
             payment_reminder_count = payment_reminder_count + 1, updated_at = NOW() WHERE invoice_id = ? AND tenant_id = ?',
            [$recipient, $id, Database::tenantId()]
        );
        Response::success(['invoice_id' => $id, 'recipient_email' => $recipient, 'sent_at' => date('Y-m-d H:i:s')], 'Payment reminder sent');
    }

    private function cleanRecurringItems(mixed $items): array
    {
        if (!is_array($items) || !$items) Response::error('items must be a non-empty array', 422);
        $clean = [];
        foreach ($items as $index => $item) {
            $description = trim((string)($item['description'] ?? ''));
            $quantity = (float)($item['quantity'] ?? 0);
            $price = (float)($item['unit_price'] ?? 0);
            $rate = (float)($item['gst_rate'] ?? 0);
            if ($description === '' || $quantity <= 0 || $price < 0) {
                Response::error("items[$index] requires description, quantity > 0, and unit_price >= 0", 422);
            }
            if (!in_array((int)$rate, [0,5,12,18,28], true)) Response::error("items[$index].gst_rate is invalid", 422);
            $clean[] = [
                'description' => Request::sanitize($description),
                'hsn_code' => trim((string)($item['hsn_code'] ?? '')) ?: null,
                'quantity' => $quantity,
                'unit' => trim((string)($item['unit'] ?? '')) ?: 'Nos',
                'unit_price' => $price,
                'gst_rate' => $rate,
                'sort_order' => $index + 1,
            ];
        }
        return $clean;
    }

    private function insertRecurringItems(int $templateId, array $items): void
    {
        foreach ($items as $item) Database::insertTenant('recurring_invoice_template_items', ['template_id' => $templateId, ...$item]);
    }

    private function createRecurringInvoice(array $template, array $items, string $runDate): array
    {
        $subtotal = $tax = 0.0;
        foreach ($items as $item) {
            $line = round((float)$item['quantity'] * (float)$item['unit_price'], 2);
            $subtotal += $line;
            $tax += round($line * (float)$item['gst_rate'] / 100, 2);
        }
        $discount = max(0.0, (float)$template['discount']);
        $taxable = max(0.0, $subtotal - $discount);
        $tax = round($tax * ($subtotal > 0 ? $taxable / $subtotal : 1), 2);
        $interState = strtolower((string)$template['customer_state']) !== strtolower((string)$template['seller_state']);
        $cgst = $sgst = $igst = 0.0;
        if ($interState) $igst = $tax;
        else { $cgst = round($tax / 2, 2); $sgst = $tax - $cgst; }
        $delivery = max(0.0, (float)$template['delivery_fee']);
        $dueDate = (new \DateTimeImmutable($runDate))->modify('+' . max(0, (int)$template['due_days']) . ' days')->format('Y-m-d');
        $invoiceId = Database::insertTenant('invoices', [
            'invoice_number' => $this->nextInvoiceNumber(),
            'order_id' => null,
            'recurring_template_id' => (int)$template['template_id'],
            'recurring_run_date' => $runDate,
            'customer_name' => $template['customer_name'],
            'customer_email' => $template['customer_email'] ?: null,
            'customer_gstin' => $template['customer_gstin'] ?: null,
            'customer_state' => $template['customer_state'],
            'customer_address' => $template['customer_address'] ?: null,
            'seller_state' => $template['seller_state'],
            'invoice_date' => $runDate,
            'due_date' => $dueDate,
            'subtotal' => $subtotal,
            'gst_rate' => $taxable > 0 ? round($tax / $taxable * 100, 2) : 0,
            'gst_amount' => $tax,
            'cgst_amount' => $cgst,
            'sgst_amount' => $sgst,
            'igst_amount' => $igst,
            'delivery_fee' => $delivery,
            'discount' => $discount,
            'total' => round($taxable + $tax + $delivery),
            'status' => 'Draft',
            'payment_status' => 'unpaid',
            'notes' => $template['notes'] ?: null,
            'terms_and_conditions' => $template['terms_and_conditions'] ?: null,
        ]);
        foreach ($items as $item) {
            Database::insertTenant('invoice_items', [
                'invoice_id' => $invoiceId,
                'description' => $item['description'],
                'hsn_code' => $item['hsn_code'] ?: null,
                'quantity' => (float)$item['quantity'],
                'unit' => $item['unit'] ?: 'Nos',
                'unit_price' => (float)$item['unit_price'],
                'gst_rate' => (float)$item['gst_rate'],
                'line_total' => round((float)$item['quantity'] * (float)$item['unit_price'], 2),
                'sort_order' => (int)$item['sort_order'],
            ]);
        }
        return Database::fetch('SELECT * FROM invoices WHERE invoice_id = ? AND tenant_id = ?', [$invoiceId, Database::tenantId()]) ?? [];
    }

    private function nextInvoiceNumber(): string
    {
        $maxId = (int)(Database::fetch('SELECT MAX(invoice_id) AS max_id FROM invoices WHERE tenant_id = ?', [Database::tenantId()])['max_id'] ?? 0);
        $prefix = Database::fetch("SELECT setting_value FROM settings WHERE setting_key = 'invoice_prefix' AND tenant_id = ?", [Database::tenantId()])['setting_value'] ?? 'INV';
        return $prefix . '-' . date('Y') . '-' . str_pad((string)($maxId + 1), 4, '0', STR_PAD_LEFT);
    }

    private function advanceRecurringDate(string $date, string $frequency): string
    {
        $current = new \DateTimeImmutable($date);
        if ($frequency === 'weekly') {
            return $current->modify('+1 week')->format('Y-m-d');
        }
        $months = $frequency === 'quarterly' ? 3 : 1;
        $day = (int)$current->format('d');
        $targetMonth = $current->modify('first day of +' . $months . ' months');
        $targetDay = min($day, (int)$targetMonth->format('t'));
        return $targetMonth->setDate(
            (int)$targetMonth->format('Y'),
            (int)$targetMonth->format('m'),
            $targetDay
        )->format('Y-m-d');
    }

    private function validDate(string $date): bool
    {
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        return $parsed !== false && $parsed->format('Y-m-d') === $date;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ─── CREDIT NOTES ─────────────────────────────────────────────────────────
    // A credit note corrects/reduces a previously issued invoice (return,
    // pricing error, goodwill adjustment). Linked to exactly one invoice;
    // an Issued credit note reduces that invoice's effective receivable
    // (exposed as `credited_total` / adjusted `balance_due` on the invoice
    // read path below). Tenant-scoped throughout — see database/create_invoicing_extra.sql.
    // ════════════════════════════════════════════════════════════════════════

    private const CREDIT_NOTE_STATUSES = ['Draft', 'Issued', 'Cancelled'];

    /** Sum of Issued credit notes for an invoice (reduces its receivable). */
    private static function creditedTotalForInvoice(int $invoiceId): float
    {
        return (float)(Database::fetch(
            "SELECT COALESCE(SUM(total), 0) AS total FROM credit_notes
             WHERE invoice_id = ? AND tenant_id = ? AND status = 'Issued'",
            [$invoiceId, Database::tenantId()]
        )['total'] ?? 0);
    }

    // ─── GET /admin/credit-notes — list, optional ?invoice_id= filter ───────
    public function creditNoteIndex(Request $request): void
    {
        $page  = max(1, (int)$request->query('page', 1));
        $limit = min(500, max(1, (int)$request->query('limit', 20)));

        $where  = ['cn.tenant_id = ?'];
        $params = [Database::tenantId()];

        if ($invoiceId = (int)$request->query('invoice_id')) {
            $where[]  = 'cn.invoice_id = ?';
            $params[] = $invoiceId;
        }
        if ($status = $request->query('status')) {
            if (!in_array((string)$status, self::CREDIT_NOTE_STATUSES, true)) {
                Response::error('Invalid status; must be one of: ' . implode(', ', self::CREDIT_NOTE_STATUSES), 422);
            }
            $where[]  = 'cn.status = ?';
            $params[] = $status;
        }

        $whereClause = implode(' AND ', $where);

        $total = Database::count(
            "SELECT COUNT(*) AS cnt FROM credit_notes cn WHERE $whereClause",
            $params
        );
        $offset = ($page - 1) * $limit;

        $rows = Database::fetchAll(
            "SELECT cn.credit_note_id, cn.credit_note_number, cn.invoice_id,
                    i.invoice_number, i.customer_name,
                    cn.credit_note_date, cn.reason, cn.notes,
                    cn.subtotal, cn.gst_amount, cn.cgst_amount, cn.sgst_amount, cn.igst_amount, cn.total,
                    cn.status, cn.created_at,
                    (SELECT COUNT(*) FROM credit_note_items cni WHERE cni.credit_note_id = cn.credit_note_id AND cni.tenant_id = cn.tenant_id) AS item_count
             FROM credit_notes cn
             LEFT JOIN invoices i ON i.invoice_id = cn.invoice_id AND i.tenant_id = cn.tenant_id
             WHERE $whereClause
             ORDER BY cn.created_at DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );

        foreach ($rows as &$r) {
            foreach (['subtotal', 'gst_amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total'] as $f) {
                $r[$f] = (float)$r[$f];
            }
        }

        Response::paginated($rows, [
            'page'        => $page,
            'limit'       => $limit,
            'total'       => $total,
            'total_pages' => (int)ceil($total / $limit),
        ]);
    }

    // ─── GET /admin/credit-notes/{id} ────────────────────────────────────────
    public function creditNoteShow(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid credit note ID', 400);
        }

        $cn = Database::fetch(
            'SELECT cn.*, i.invoice_number, i.customer_name, i.customer_gstin, i.total AS invoice_total
             FROM credit_notes cn
             LEFT JOIN invoices i ON i.invoice_id = cn.invoice_id AND i.tenant_id = cn.tenant_id
             WHERE cn.credit_note_id = ? AND cn.tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
        if (!$cn) {
            Response::error('Credit note not found', 404);
        }

        $items = Database::fetchAll(
            'SELECT item_id, description, hsn_code, quantity, unit, unit_price, gst_rate, line_total, sort_order
             FROM credit_note_items WHERE credit_note_id = ? AND tenant_id = ? ORDER BY sort_order ASC, item_id ASC',
            [$id, Database::tenantId()]
        );
        foreach ($items as &$it) {
            foreach (['quantity', 'unit_price', 'gst_rate', 'line_total'] as $f) {
                $it[$f] = (float)$it[$f];
            }
        }
        foreach (['subtotal', 'gst_amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total'] as $f) {
            $cn[$f] = (float)$cn[$f];
        }
        $cn['items'] = $items;
        Response::success($cn);
    }

    // ─── POST /admin/credit-notes — create (with optional line items) ───────
    public function creditNoteStore(Request $request): void
    {
        Validator::make($request->only(['invoice_id']), [
            'invoice_id' => 'required|integer',
        ])->validate();

        $invoiceId = (int)$request->input('invoice_id');
        $invoice = Database::fetch(
            'SELECT invoice_id, customer_state, seller_state, gst_rate, total FROM invoices WHERE invoice_id = ? AND tenant_id = ? LIMIT 1',
            [$invoiceId, Database::tenantId()]
        );
        if (!$invoice) {
            Response::error('Invoice not found', 404);
        }

        $items = $request->input('items');
        $hasItems = is_array($items) && !empty($items);

        $cleanItems = [];
        $subtotal = 0.0;
        $gstTotal = 0.0;

        if ($hasItems) {
            foreach ($items as $idx => $it) {
                $desc  = trim((string)($it['description'] ?? ''));
                $qty   = (float)($it['quantity']   ?? 0);
                $price = (float)($it['unit_price'] ?? 0);
                $rate  = (float)($it['gst_rate']   ?? $invoice['gst_rate'] ?? 0);
                $hsn   = trim((string)($it['hsn_code'] ?? ''));
                $unit  = trim((string)($it['unit'] ?? '')) ?: 'Nos';
                if ($desc === '') Response::error("items[$idx].description is required", 422);
                if ($qty   <= 0) Response::error("items[$idx].quantity must be > 0", 422);
                if ($price <  0) Response::error("items[$idx].unit_price cannot be negative", 422);
                $lineSub   = round($qty * $price, 2);
                $lineTax   = round($lineSub * $rate / 100, 2);
                $subtotal += $lineSub;
                $gstTotal += $lineTax;
                $cleanItems[] = compact('desc', 'qty', 'unit', 'price', 'rate', 'hsn', 'lineSub') + ['sort' => $idx + 1];
            }
        } else {
            // Amount-only credit note (no line items) — direct subtotal/gst input.
            $subtotal = max(0.0, (float)($request->input('amount') ?? 0));
            if ($subtotal <= 0) {
                Response::error('Provide either `items` or a positive `amount`', 422);
            }
            $rate = (float)($request->input('gst_rate') ?? $invoice['gst_rate'] ?? 0);
            $gstTotal = round($subtotal * $rate / 100, 2);
        }

        $customerState = (string)($invoice['customer_state'] ?? 'Tamil Nadu');
        $sellerState   = (string)($invoice['seller_state']   ?? 'Tamil Nadu');
        $interState    = strtolower($customerState) !== strtolower($sellerState);

        $cgst = $sgst = $igst = 0.0;
        if ($interState) {
            $igst = $gstTotal;
        } else {
            $cgst = round($gstTotal / 2, 2);
            $sgst = $gstTotal - $cgst;
        }
        $total = round($subtotal + $gstTotal, 2);

        // Numbering follows the same per-tenant MAX(id)+1 pattern AdminInvoiceController
        // already uses for invoice numbers (see generateForOrder/storeGst above).
        $maxId    = (int)(Database::fetch('SELECT MAX(credit_note_id) AS max_id FROM credit_notes WHERE tenant_id = ?', [Database::tenantId()])['max_id'] ?? 0);
        $cnPrefix = Database::fetch("SELECT setting_value FROM settings WHERE setting_key = 'credit_note_prefix' AND tenant_id = ?", [Database::tenantId()])['setting_value'] ?? 'CN';
        $cnNumber = $cnPrefix . '-' . date('Y') . '-' . str_pad((string)($maxId + 1), 4, '0', STR_PAD_LEFT);

        $status = $request->input('status') ?: 'Draft';
        if (!in_array((string)$status, self::CREDIT_NOTE_STATUSES, true)) {
            Response::error('Invalid status; must be one of: ' . implode(', ', self::CREDIT_NOTE_STATUSES), 422);
        }

        Database::beginTransaction();
        try {
            $creditNoteId = Database::insertTenant('credit_notes', [
                'credit_note_number' => $cnNumber,
                'invoice_id'         => $invoiceId,
                'credit_note_date'   => $request->input('credit_note_date') ?: date('Y-m-d'),
                'reason'             => $request->input('reason') ? Request::sanitize((string)$request->input('reason')) : null,
                'notes'              => $request->input('notes') ? Request::sanitize((string)$request->input('notes')) : null,
                'subtotal'           => $subtotal,
                'gst_amount'         => $gstTotal,
                'cgst_amount'        => $cgst,
                'sgst_amount'        => $sgst,
                'igst_amount'        => $igst,
                'total'              => $total,
                'status'             => $status,
                'created_by'         => $request->user['user_id'] ?? null,
            ]);

            foreach ($cleanItems as $it) {
                Database::insertTenant('credit_note_items', [
                    'credit_note_id' => $creditNoteId,
                    'description'    => $it['desc'],
                    'hsn_code'       => $it['hsn'] ?: null,
                    'quantity'       => $it['qty'],
                    'unit'           => $it['unit'],
                    'unit_price'     => $it['price'],
                    'gst_rate'       => $it['rate'],
                    'line_total'     => $it['lineSub'],
                    'sort_order'     => $it['sort'],
                ]);
            }
            Database::commit();
        } catch (\Throwable $e) {
            Database::rollback();
            Response::error('Failed to create credit note: ' . $e->getMessage(), 500);
        }

        $created = Database::fetch('SELECT * FROM credit_notes WHERE credit_note_id = ? AND tenant_id = ? LIMIT 1', [$creditNoteId, Database::tenantId()]);
        Response::success($created, 'Credit note created successfully', 201);
    }

    // ─── PUT /admin/credit-notes/{id} — update header (+ status transitions) ─
    public function creditNoteUpdate(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid credit note ID', 400);
        }
        $existing = Database::fetch('SELECT credit_note_id, status FROM credit_notes WHERE credit_note_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        if (!$existing) {
            Response::error('Credit note not found', 404);
        }
        if ($existing['status'] === 'Cancelled') {
            Response::error('Cancelled credit notes cannot be modified', 422);
        }

        $allowed = ['credit_note_date', 'reason', 'notes', 'status'];
        $sets   = [];
        $params = [];
        foreach ($allowed as $col) {
            $val = $request->input($col);
            if ($val === null) continue;
            if ($col === 'status') {
                if (!in_array((string)$val, self::CREDIT_NOTE_STATUSES, true)) {
                    Response::error('Invalid status; must be one of: ' . implode(', ', self::CREDIT_NOTE_STATUSES), 422);
                }
            }
            $sets[]   = "$col = ?";
            $params[] = in_array($col, ['reason', 'notes'], true) ? Request::sanitize((string)$val) : $val;
        }

        if (empty($sets)) {
            Response::error('Provide at least one field to update', 400);
        }

        $sets[]   = 'updated_at = NOW()';
        $params[] = $id;
        $params[] = Database::tenantId();

        Database::execute('UPDATE credit_notes SET ' . implode(', ', $sets) . ' WHERE credit_note_id = ? AND tenant_id = ?', $params);

        $row = Database::fetch('SELECT * FROM credit_notes WHERE credit_note_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        Response::success($row, 'Credit note updated successfully');
    }

    // ─── DELETE /admin/credit-notes/{id} — only Draft notes may be deleted ───
    public function creditNoteDestroy(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid credit note ID', 400);
        }
        $existing = Database::fetch('SELECT credit_note_id, status FROM credit_notes WHERE credit_note_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        if (!$existing) {
            Response::error('Credit note not found', 404);
        }
        if ($existing['status'] !== 'Draft') {
            Response::error('Only Draft credit notes can be deleted; cancel an issued credit note instead', 422);
        }
        Database::execute('DELETE FROM credit_note_items WHERE credit_note_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        Database::execute('DELETE FROM credit_notes WHERE credit_note_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        Response::success(null, 'Credit note deleted successfully');
    }
}
