<?php
declare(strict_types=1);

/**
 * Admin Outstanding Controller
 * Uses outstanding_entries + outstanding_payments tables (created via migration).
 * Falls back gracefully if tables don't exist yet.
 *
 * GET  /admin/outstanding/summary
 * GET  /admin/outstanding/receivables
 * GET  /admin/outstanding/payables
 * POST /admin/outstanding/{id}/payment
 * GET  /admin/outstanding/{id}/payments
 */
class AdminOutstandingController
{
    private function tablesExist(): bool
    {
        try {
            Database::fetch('SELECT 1 FROM outstanding_entries LIMIT 1', []);
            return true;
        } catch (\Throwable $e) {
            return false;
        }
    }

    // GET /admin/outstanding/summary
    public function summary(Request $request): void
    {
        $tid = Database::tenantId();

        if (!$this->tablesExist()) {
            Response::success($this->derivedSummary($tid));
            return;
        }

        $receivable = (float)(Database::fetch(
            'SELECT COALESCE(SUM(balance_amount), 0) AS total FROM outstanding_entries WHERE tenant_id = ? AND type = "receivable" AND status != "paid"',
            [$tid]
        )['total'] ?? 0);

        $payable = (float)(Database::fetch(
            'SELECT COALESCE(SUM(balance_amount), 0) AS total FROM outstanding_entries WHERE tenant_id = ? AND type = "payable" AND status != "paid"',
            [$tid]
        )['total'] ?? 0);

        $overdue = (float)(Database::fetch(
            'SELECT COALESCE(SUM(balance_amount), 0) AS total FROM outstanding_entries WHERE tenant_id = ? AND type = "receivable" AND status != "paid" AND due_date <= CURDATE()',
            [$tid]
        )['total'] ?? 0);

        // Aging buckets for receivables
        $aging = [
            'current' => (float)(Database::fetch('SELECT COALESCE(SUM(balance_amount),0) AS t FROM outstanding_entries WHERE tenant_id=? AND type="receivable" AND status!="paid" AND (due_date IS NULL OR due_date > CURDATE())', [$tid])['t'] ?? 0),
            'due_30'  => (float)(Database::fetch('SELECT COALESCE(SUM(balance_amount),0) AS t FROM outstanding_entries WHERE tenant_id=? AND type="receivable" AND status!="paid" AND due_date <= CURDATE() AND due_date >= DATE_SUB(CURDATE(),INTERVAL 30 DAY)', [$tid])['t'] ?? 0),
            'due_60'  => (float)(Database::fetch('SELECT COALESCE(SUM(balance_amount),0) AS t FROM outstanding_entries WHERE tenant_id=? AND type="receivable" AND status!="paid" AND due_date < DATE_SUB(CURDATE(),INTERVAL 30 DAY) AND due_date >= DATE_SUB(CURDATE(),INTERVAL 60 DAY)', [$tid])['t'] ?? 0),
            'due_90'  => (float)(Database::fetch('SELECT COALESCE(SUM(balance_amount),0) AS t FROM outstanding_entries WHERE tenant_id=? AND type="receivable" AND status!="paid" AND due_date < DATE_SUB(CURDATE(),INTERVAL 60 DAY) AND due_date >= DATE_SUB(CURDATE(),INTERVAL 90 DAY)', [$tid])['t'] ?? 0),
            'overdue' => (float)(Database::fetch('SELECT COALESCE(SUM(balance_amount),0) AS t FROM outstanding_entries WHERE tenant_id=? AND type="receivable" AND status!="paid" AND due_date < DATE_SUB(CURDATE(),INTERVAL 90 DAY)', [$tid])['t'] ?? 0),
        ];

        $recCount = (int)(Database::fetch('SELECT COUNT(*) AS cnt FROM outstanding_entries WHERE tenant_id=? AND type="receivable" AND status!="paid"', [$tid])['cnt'] ?? 0);
        $payCount = (int)(Database::fetch('SELECT COUNT(*) AS cnt FROM outstanding_entries WHERE tenant_id=? AND type="payable" AND status!="paid"', [$tid])['cnt'] ?? 0);

        Response::success([
            'total_receivable'  => $receivable,
            'total_payable'     => $payable,
            'overdue_amount'    => $overdue,
            'overdue_90_plus'   => $overdue,
            'net_receivable'    => $receivable - $payable,
            'receivable_count'  => $recCount,
            'payable_count'     => $payCount,
            'aging'             => $aging,
        ]);
    }

    // GET /admin/outstanding/receivables
    public function receivables(Request $request): void
    {
        $tid = Database::tenantId();

        if (!$this->tablesExist()) {
            Response::success([]);
            return;
        }

        $rows = Database::fetchAll(
            'SELECT entry_id AS id, invoice_id, type, party_name AS customer_name,
                    party_gstin AS customer_gstin, invoice_number, invoice_date, due_date,
                    total_amount, paid_amount AS advance_amount, balance_amount,
                    status, credit_days, created_at, "receivable" AS type_label
             FROM outstanding_entries
             WHERE tenant_id = ? AND type = "receivable"
             ORDER BY due_date ASC, created_at DESC',
            [$tid]
        );
        foreach ($rows as &$r) {
            $r['total_amount']   = (float)$r['total_amount'];
            $r['advance_amount'] = (float)$r['advance_amount'];
            $r['balance_amount'] = (float)$r['balance_amount'];
        }
        Response::success($rows);
    }

    // GET /admin/outstanding/payables
    public function payables(Request $request): void
    {
        $tid = Database::tenantId();

        if (!$this->tablesExist()) {
            Response::success([]);
            return;
        }

        $rows = Database::fetchAll(
            'SELECT entry_id AS id, invoice_id, type, party_name AS vendor_name,
                    party_gstin AS vendor_gstin, invoice_number, invoice_date, due_date,
                    total_amount, paid_amount AS advance_amount, balance_amount,
                    status, credit_days, created_at
             FROM outstanding_entries
             WHERE tenant_id = ? AND type = "payable"
             ORDER BY due_date ASC, created_at DESC',
            [$tid]
        );
        foreach ($rows as &$r) {
            $r['total_amount']   = (float)$r['total_amount'];
            $r['advance_amount'] = (float)$r['advance_amount'];
            $r['balance_amount'] = (float)$r['balance_amount'];
        }
        Response::success($rows);
    }

    // POST /admin/outstanding/{id}/payment
    public function recordPayment(Request $request): void
    {
        $id     = (int)$request->param('id');
        $tid    = Database::tenantId();
        $amount = (float)($request->input('amount') ?? 0);
        $date   = $request->input('payment_date') ?: date('Y-m-d');
        $method = $request->input('payment_method') ?: null;
        $notes  = $request->input('notes') ? Request::sanitize((string)$request->input('notes')) : null;

        if ($amount <= 0) Response::error('amount must be positive', 422);

        if (!$this->tablesExist()) {
            Response::error('Outstanding entries table not yet created. Run database migrations first.', 503);
        }

        $entry = Database::fetch('SELECT * FROM outstanding_entries WHERE entry_id = ? AND tenant_id = ? LIMIT 1', [$id, $tid]);
        if (!$entry) Response::error('Outstanding entry not found', 404);

        if ((float)$entry['balance_amount'] <= 0) {
            Response::error('This entry is already fully paid', 422);
        }
        if ($amount > (float)$entry['balance_amount']) {
            $amount = (float)$entry['balance_amount']; // cap at balance
        }

        // CREATE TABLE causes implicit commit in MySQL — must run BEFORE beginTransaction
        Database::execute(
            'CREATE TABLE IF NOT EXISTS `invoice_payments` (
              `payment_id` INT(11) NOT NULL AUTO_INCREMENT,
              `tenant_id` INT NOT NULL,
              `invoice_id` INT(11) DEFAULT NULL,
              `payment_date` DATE NOT NULL,
              `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
              `payment_method` VARCHAR(50) NOT NULL DEFAULT "bank_transfer",
              `payment_type` ENUM("received","paid","refund") NOT NULL DEFAULT "received",
              `party_name` VARCHAR(255) DEFAULT NULL,
              `notes` TEXT DEFAULT NULL,
              `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`payment_id`),
              KEY `idx_inv_payments_tenant` (`tenant_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
            []
        );

        Database::beginTransaction();
        try {
            Database::insert(
                'INSERT INTO outstanding_payments (tenant_id, entry_id, amount, payment_date, payment_method, notes, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())',
                [$tid, $id, $amount, $date, $method, $notes]
            );

            $newPaid    = (float)$entry['paid_amount'] + $amount;
            $newBalance = max(0, (float)$entry['total_amount'] - $newPaid);
            $newStatus  = $newBalance <= 0 ? 'paid' : ($newPaid > 0 ? 'partial' : 'pending');

            Database::execute(
                'UPDATE outstanding_entries SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = NOW()
                 WHERE entry_id = ? AND tenant_id = ?',
                [$newPaid, $newBalance, $newStatus, $id, $tid]
            );

            // Audit log
            Database::insert(
                'INSERT INTO audit_log (tenant_id, action, table_name, record_id, new_value, created_at)
                 VALUES (?, "payment_recorded", "outstanding_entries", ?, ?, NOW())',
                [$tid, $id, json_encode(['amount' => $amount, 'balance_after' => $newBalance, 'method' => $method])]
            );

            // Also record in invoice_payments so Finance > Payments tab shows it
            $paymentType = ($entry['type'] === 'payable') ? 'paid' : 'received';
            Database::insert(
                'INSERT INTO invoice_payments
                    (tenant_id, invoice_id, payment_date, amount, payment_method, payment_type, party_name, notes, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                [
                    $tid,
                    $entry['invoice_id'] ?? null,
                    $date, $amount,
                    $method ?: 'bank_transfer',
                    $paymentType,
                    $entry['party_name'] ?? null,
                    $notes ?: ($paymentType === 'paid' ? 'Payment against payable' : 'Receipt against receivable'),
                ]
            );

            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            Response::error('Payment recording failed: ' . $e->getMessage(), 500);
        }

        $updated = Database::fetch('SELECT * FROM outstanding_entries WHERE entry_id = ? AND tenant_id = ? LIMIT 1', [$id, $tid]);
        Response::success([
            'entry'          => $updated,
            'payment_amount' => $amount,
            'new_balance'    => $newBalance,
            'status'         => $newStatus,
        ], 'Payment recorded');
    }

    // GET /admin/outstanding/{id}/payments
    public function paymentHistory(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();

        if (!$this->tablesExist()) {
            Response::success(['payments' => []]);
            return;
        }

        $rows = Database::fetchAll(
            'SELECT payment_id, amount, payment_method, payment_date, notes, created_at
             FROM outstanding_payments WHERE tenant_id = ? AND entry_id = ?
             ORDER BY payment_date DESC',
            [$tid, $id]
        );
        foreach ($rows as &$r) { $r['amount'] = (float)$r['amount']; }
        Response::success(['payments' => $rows]);
    }

    // Derived summary when table doesn't exist (backward compat)
    private function derivedSummary(int $tid): array
    {
        $total = (float)(Database::fetch(
            'SELECT COALESCE(SUM(total_amount), 0) AS total FROM marketplace_sales_orders WHERE tenant_id = ? AND status = "completed"',
            [$tid]
        )['total'] ?? 0);
        return [
            'total_receivable' => $total,
            'total_payable' => 0.0,
            'overdue_amount' => 0.0,
            'overdue_90_plus' => 0.0,
            'net_receivable' => $total,
            'receivable_count' => 0,
            'payable_count' => 0,
            'aging' => ['current' => $total, 'due_30' => 0, 'due_60' => 0, 'due_90' => 0, 'overdue' => 0],
            'note' => 'Run database migration to enable credit tracking',
        ];
    }
}
