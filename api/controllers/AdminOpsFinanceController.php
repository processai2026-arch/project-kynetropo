<?php
declare(strict_types=1);

/**
 * Ops Finance Controller
 * GET  /admin/ops/finance/summary    — P&L summary
 * GET  /admin/ops/finance/payments   — payment log
 * POST /admin/ops/finance/payments   — add payment (updates project balance + client timeline)
 * GET  /admin/ops/finance/expenses   — expense log
 * POST /admin/ops/finance/expenses   — add expense
 * PUT  /admin/ops/finance/payments/{id}  — update payment
 * DELETE /admin/ops/finance/payments/{id}
 * DELETE /admin/ops/finance/expenses/{id}
 */
class AdminOpsFinanceController
{
    public function summary(Request $request): void
    {
        $tenantId = Database::tenantId();
        $month    = $request->query('month') ?? date('Y-m');
        $projectId = $request->query('project_id') ? (int)$request->query('project_id') : null;

        $revenueAll = Database::fetch(
            "SELECT COALESCE(SUM(amount),0) AS total FROM ops_payments WHERE tenant_id = ?",
            [$tenantId]
        );
        $revenueMonth = Database::fetch(
            "SELECT COALESCE(SUM(amount),0) AS total FROM ops_payments
             WHERE tenant_id = ? AND DATE_FORMAT(payment_date,'%Y-%m') = ?",
            [$tenantId, $month]
        );
        $expensesMonth = Database::fetch(
            "SELECT COALESCE(SUM(amount),0) AS total FROM ops_expenses
             WHERE tenant_id = ? AND DATE_FORMAT(date,'%Y-%m') = ?",
            [$tenantId, $month]
        );
        $pendingAll = Database::fetch(
            "SELECT COALESCE(SUM(balance),0) AS total FROM ops_projects
             WHERE tenant_id = ? AND payment_status != 'paid'",
            [$tenantId]
        );

        $byProject = Database::fetchAll(
            "SELECT p.id, p.project_code, p.name, c.client_code, c.name AS client_name, p.quoted, p.received, p.balance, p.payment_status,
                    CASE WHEN p.quoted > 0 THEN ROUND(p.received / p.quoted * 100, 1) ELSE 0 END AS pct_collected
             FROM ops_projects p
             JOIN ops_clients c ON c.id = p.client_id
             WHERE p.tenant_id = ? AND p.stage != 'Closed'
             ORDER BY p.balance DESC",
            [$tenantId]
        );

        Response::success([
            'total_revenue_all_time' => (float)$revenueAll['total'],
            'total_revenue_month'    => (float)$revenueMonth['total'],
            'total_collected_month'  => (float)$revenueMonth['total'],
            'total_pending'          => (float)$pendingAll['total'],
            'total_expenses_month'   => (float)$expensesMonth['total'],
            'net_profit_month'       => (float)$revenueMonth['total'] - (float)$expensesMonth['total'],
            'by_project'             => $byProject,
        ]);
    }

    public function payments(Request $request): void
    {
        $tenantId  = Database::tenantId();
        $projectId = $request->query('project_id') ? (int)$request->query('project_id') : null;
        $month     = $request->query('month');

        $sql    = "SELECT p.*, c.name AS client_name, c.client_code, pr.name AS project_name, pr.project_code
                   FROM ops_payments p
                   JOIN ops_clients  c  ON c.id  = p.client_id  AND c.tenant_id  = p.tenant_id
                   JOIN ops_projects pr ON pr.id = p.project_id AND pr.tenant_id = p.tenant_id
                   WHERE p.tenant_id = ?";
        $params = [$tenantId];
        if ($projectId) { $sql .= ' AND p.project_id = ?';                   $params[] = $projectId; }
        if ($month)     { $sql .= " AND DATE_FORMAT(p.payment_date,'%Y-%m') = ?"; $params[] = $month; }
        $sql .= ' ORDER BY p.payment_date DESC';
        Response::success(Database::fetchAll($sql, $params));
    }

    public function addPayment(Request $request): void
    {
        $body      = $request->body();
        $tenantId  = Database::tenantId();
        $clientId  = (int)($body['client_id']  ?? 0);
        $projectId = (int)($body['project_id'] ?? 0);
        $amount    = (float)($body['amount']   ?? 0);

        if (!$clientId)  Response::error('Client is required', 422);
        if (!$projectId) Response::error('Project is required', 422);
        if ($amount <= 0) Response::error('Amount must be positive', 422);

        $project = Database::fetch(
            'SELECT * FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$projectId, $tenantId]
        );
        if (!$project) Response::error('Project not found', 404);

        $payDate = $body['payment_date'] ?? date('Y-m-d');

        $id = Database::insert('ops_payments', [
            'tenant_id'    => $tenantId,
            'client_id'    => $clientId,
            'project_id'   => $projectId,
            'amount'       => $amount,
            'type'         => in_array($body['type'] ?? '', ['advance','mid','final','amc','other']) ? $body['type'] : 'advance',
            'mode'         => in_array($body['mode'] ?? '', ['cash','bank_transfer','upi','cheque','other']) ? $body['mode'] : 'bank_transfer',
            'reference'    => trim((string)($body['reference']   ?? '')) ?: null,
            'recorded_by'  => trim((string)($body['recorded_by'] ?? '')),
            'payment_date' => $payDate,
            'notes'        => trim((string)($body['notes'] ?? '')),
        ]);

        // Update project: received + balance + payment_status (AMC money stays out of it)
        $type = in_array($body['type'] ?? '', ['advance','mid','final','amc','other']) ? $body['type'] : 'advance';
        self::adjustProject($project, $tenantId, self::projectShare($type, $amount));

        // Log to activity (client timeline)
        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'client',
            'entity_id'   => $clientId,
            'action'      => 'payment_received',
            'description' => "Payment received ₹" . number_format($amount) . " on " . date('d M Y', strtotime($payDate)),
            'done_by'     => $body['recorded_by'] ?? '',
        ]);

        $row = Database::fetch('SELECT * FROM ops_payments WHERE id = ? LIMIT 1', [$id]);
        Response::success($row, 'Payment recorded', 201);
    }

    public function expenses(Request $request): void
    {
        $tenantId = Database::tenantId();
        $category = $request->query('category');
        $month    = $request->query('month');

        $sql    = 'SELECT * FROM ops_expenses WHERE tenant_id = ?';
        $params = [$tenantId];
        if ($category) { $sql .= ' AND category = ?';                    $params[] = $category; }
        if ($month)    { $sql .= " AND DATE_FORMAT(date,'%Y-%m') = ?";   $params[] = $month; }
        $sql .= ' ORDER BY date DESC';
        Response::success(Database::fetchAll($sql, $params));
    }

    public function addExpense(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();
        $amount   = (float)($body['amount'] ?? 0);

        if ($amount <= 0) Response::error('Amount must be positive', 422);

        $validCats = ['hosting','tools','travel','marketing','salary','pitch','other'];
        $category  = in_array($body['category'] ?? '', $validCats) ? $body['category'] : 'other';

        $id = Database::insert('ops_expenses', [
            'tenant_id'   => $tenantId,
            'category'    => $category,
            'amount'      => $amount,
            'description' => trim((string)($body['description'] ?? '')),
            'project_id'  => !empty($body['project_id']) ? (int)$body['project_id'] : null,
            'pitch_id'    => !empty($body['pitch_id'])   ? (int)$body['pitch_id']   : null,
            'date'        => $body['date'] ?? date('Y-m-d'),
            'added_by'    => trim((string)($body['added_by'] ?? '')),
        ]);

        $row = Database::fetch('SELECT * FROM ops_expenses WHERE id = ? LIMIT 1', [$id]);
        Response::success($row, 'Expense recorded', 201);
    }

    public function updatePayment(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $pay = Database::fetch('SELECT * FROM ops_payments WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId]);
        if (!$pay) Response::error('Payment not found', 404);

        $oldAmount = (float)$pay['amount'];
        $newAmount = isset($body['amount']) ? (float)$body['amount'] : $oldAmount;
        if ($newAmount <= 0) Response::error('Amount must be positive', 422);

        $updates = [];
        if (isset($body['amount']))       $updates['amount']       = $newAmount;
        if (isset($body['type']))         $updates['type']         = in_array($body['type'], ['advance','mid','final','amc','other']) ? $body['type'] : $pay['type'];
        if (isset($body['mode']))         $updates['mode']         = in_array($body['mode'], ['cash','bank_transfer','upi','cheque','other']) ? $body['mode'] : $pay['mode'];
        if (isset($body['reference']))    $updates['reference']    = trim((string)$body['reference']) ?: null;
        if (isset($body['payment_date'])) $updates['payment_date'] = $body['payment_date'];
        if (isset($body['notes']))        $updates['notes']        = trim((string)$body['notes']);

        if (!empty($updates)) {
            Database::update('ops_payments', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        // Adjust the project by what this payment now counts toward it: a changed
        // amount, or a type changed to or from AMC (which never counts).
        $oldType = (string)$pay['type'];
        $newType = (string)($updates['type'] ?? $oldType);
        $delta   = self::projectShare($newType, $newAmount) - self::projectShare($oldType, $oldAmount);
        if ($delta != 0.0) {
            $project = Database::fetch('SELECT * FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1', [(int)$pay['project_id'], $tenantId]);
            if ($project) self::adjustProject($project, $tenantId, $delta);
        }

        $row = Database::fetch('SELECT * FROM ops_payments WHERE id = ? LIMIT 1', [$id]);
        Response::success($row);
    }

    public function deletePayment(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $pay = Database::fetch('SELECT * FROM ops_payments WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId]);
        if (!$pay) Response::error('Payment not found', 404);

        // Reverse what this payment counted toward the project (nothing for AMC)
        $project = Database::fetch('SELECT * FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1', [(int)$pay['project_id'], $tenantId]);
        if ($project) self::adjustProject($project, $tenantId, -self::projectShare((string)$pay['type'], (float)$pay['amount']));

        // If it paid an AMC's current year, that year is unpaid again
        if ((string)($pay['type'] ?? '') === 'amc') AdminOpsAmcController::paymentRemoved($tenantId, $id);

        Database::query('DELETE FROM ops_payments WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);

        // Log deletion to client activity timeline
        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'client',
            'entity_id'   => (int)$pay['client_id'],
            'action'      => 'payment_deleted',
            'description' => "Payment of ₹" . number_format((float)$pay['amount']) . " deleted (was recorded on " . $pay['payment_date'] . ")",
            'done_by'     => '',
        ]);

        Response::success(['deleted' => true]);
    }

    public function deleteExpense(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_expenses WHERE id = ? AND tenant_id = ?', [$id, $tenantId])
            ?: Response::error('Expense not found', 404);
        Database::query('DELETE FROM ops_expenses WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(['message' => 'Expense deleted']);
    }

    /**
     * How much of a payment counts toward its project's received amount. AMC
     * is a separate yearly charge, not part of the project price, so an AMC
     * payment counts for nothing there; it is still a payment in Finance.
     */
    public static function projectShare(string $type, float $amount): float
    {
        return $type === 'amc' ? 0.0 : $amount;
    }

    /** Add $delta to a project's received amount and recompute its balance and payment status. */
    private static function adjustProject(array $project, int $tenantId, float $delta): void
    {
        if ($delta == 0.0) return;
        $newReceived = max(0, (float)$project['received'] + $delta);
        $newBalance  = (float)$project['quoted'] - $newReceived;
        $newStatus   = $newBalance <= 0 ? 'paid' : ($newReceived > 0 ? 'partial' : 'pending');
        Database::update('ops_projects', [
            'received'       => $newReceived,
            'balance'        => max(0, $newBalance),
            'payment_status' => $newStatus,
        ], ['id' => $project['id'], 'tenant_id' => $tenantId]);
    }
}
