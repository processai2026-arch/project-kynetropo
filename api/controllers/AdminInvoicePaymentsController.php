<?php
declare(strict_types=1);

/**
 * Admin Invoice Payments Controller
 * GET  /admin/invoice-payments          — list all payments
 * POST /admin/invoice-payments          — record a payment
 * GET  /admin/invoice-payments/{id}     — single payment
 * PUT  /admin/invoice-payments/{id}     — update payment
 * DELETE /admin/invoice-payments/{id}  — delete payment
 */
class AdminInvoicePaymentsController
{
    private function ensureTable(): void
    {
        Database::execute(
            'CREATE TABLE IF NOT EXISTS `invoice_payments` (
              `payment_id`      INT(11) NOT NULL AUTO_INCREMENT,
              `tenant_id`       INT NOT NULL,
              `invoice_id`      INT(11) DEFAULT NULL,
              `payment_date`    DATE NOT NULL,
              `amount`          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              `payment_method`  VARCHAR(50) NOT NULL DEFAULT "bank_transfer",
              `payment_type`    ENUM("received","paid","refund") NOT NULL DEFAULT "received",
              `party_name`      VARCHAR(255) DEFAULT NULL,
              `notes`           TEXT DEFAULT NULL,
              `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `updated_at`      DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (`payment_id`),
              KEY `idx_inv_payments_tenant`      (`tenant_id`),
              KEY `idx_inv_payments_tenant_date` (`tenant_id`, `payment_date`),
              KEY `idx_inv_payments_invoice`     (`invoice_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            []
        );
    }

    public function index(Request $request): void
    {
        $this->ensureTable();
        $tid    = Database::tenantId();
        $page   = max(1, (int)$request->query('page', 1));
        $limit  = min(200, max(1, (int)$request->query('limit', 100)));
        $where  = ['p.tenant_id = ?'];
        $params = [$tid];

        if ($type = $request->query('type')) {
            if (in_array($type, ['received','paid','refund'], true)) {
                $where[] = 'p.payment_type = ?'; $params[] = $type;
            }
        }
        if ($from = $request->query('from_date')) { $where[] = 'p.payment_date >= ?'; $params[] = $from; }
        if ($to   = $request->query('to_date'))   { $where[] = 'p.payment_date <= ?'; $params[] = $to; }

        $wc     = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM invoice_payments p WHERE $wc", $params);
        $offset = ($page - 1) * $limit;
        $rows   = Database::fetchAll(
            "SELECT p.*, si.invoice_number
             FROM invoice_payments p
             LEFT JOIN scan_invoices si ON si.invoice_id = p.invoice_id AND si.tenant_id = p.tenant_id
             WHERE $wc ORDER BY p.payment_date DESC LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );
        foreach ($rows as &$r) { $r['amount'] = (float)$r['amount']; }
        Response::paginated($rows, [
            'page' => $page, 'limit' => $limit, 'total' => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }

    public function store(Request $request): void
    {
        $this->ensureTable();
        $tid    = Database::tenantId();
        $amount = (float)($request->input('amount') ?? 0);
        $date   = $request->input('payment_date');
        $type   = $request->input('payment_type') ?: 'received';
        $method = $request->input('payment_method') ?: 'bank_transfer';

        if ($amount <= 0) Response::error('amount must be positive', 422);
        if (!$date)       Response::error('payment_date is required', 422);
        if (!in_array($type, ['received','paid','refund'], true)) $type = 'received';

        $id = Database::insert(
            'INSERT INTO invoice_payments
                (tenant_id, invoice_id, payment_date, amount, payment_method, payment_type, party_name, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [
                $tid,
                $request->input('invoice_id') ? (int)$request->input('invoice_id') : null,
                $date,
                $amount,
                Request::sanitize((string)$method),
                $type,
                $request->input('party_name') ? Request::sanitize((string)$request->input('party_name')) : null,
                $request->input('notes') ? Request::sanitize((string)$request->input('notes')) : null,
            ]
        );
        $row = Database::fetch('SELECT * FROM invoice_payments WHERE payment_id = ? AND tenant_id = ?', [$id, $tid]);
        $row['amount'] = (float)$row['amount'];
        Response::success($row, 'Payment recorded', 201);
    }

    public function show(Request $request): void
    {
        $this->ensureTable();
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $row = Database::fetch('SELECT * FROM invoice_payments WHERE payment_id = ? AND tenant_id = ? LIMIT 1', [$id, $tid]);
        if (!$row) Response::error('Payment not found', 404);
        $row['amount'] = (float)$row['amount'];
        Response::success($row);
    }

    public function update(Request $request): void
    {
        $this->ensureTable();
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $row = Database::fetch('SELECT * FROM invoice_payments WHERE payment_id = ? AND tenant_id = ? LIMIT 1', [$id, $tid]);
        if (!$row) Response::error('Payment not found', 404);

        $allowed = ['payment_date','amount','payment_method','payment_type','party_name','notes'];
        $sets = []; $params = [];
        foreach ($allowed as $col) {
            $val = $request->input($col);
            if ($val === null) continue;
            if ($col === 'amount') $val = (float)$val;
            elseif ($col === 'payment_type' && !in_array($val, ['received','paid','refund'], true)) continue;
            elseif (in_array($col, ['payment_method','party_name','notes'], true)) $val = Request::sanitize((string)$val);
            $sets[] = "$col = ?"; $params[] = $val;
        }
        if (empty($sets)) Response::error('Nothing to update', 400);
        $sets[] = 'updated_at = NOW()'; $params[] = $id; $params[] = $tid;
        Database::execute('UPDATE invoice_payments SET ' . implode(', ', $sets) . ' WHERE payment_id = ? AND tenant_id = ?', $params);
        $updated = Database::fetch('SELECT * FROM invoice_payments WHERE payment_id = ? AND tenant_id = ?', [$id, $tid]);
        $updated['amount'] = (float)$updated['amount'];
        Response::success($updated, 'Payment updated');
    }

    public function destroy(Request $request): void
    {
        $this->ensureTable();
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $row = Database::fetch('SELECT payment_id FROM invoice_payments WHERE payment_id = ? AND tenant_id = ? LIMIT 1', [$id, $tid]);
        if (!$row) Response::error('Payment not found', 404);
        Database::execute('DELETE FROM invoice_payments WHERE payment_id = ? AND tenant_id = ?', [$id, $tid]);
        Response::success(null, 'Payment deleted');
    }
}
