<?php
declare(strict_types=1);

/**
 * Ops Finance Controller
 * GET  /admin/ops/finance/summary    — P&L summary
 * GET  /admin/ops/finance/payments   — payment log
 * GET  /admin/ops/finance/payments/{id}  — one payment, with its project and AMC
 * POST /admin/ops/finance/payments   — add payment (updates project balance + client timeline)
 * GET  /admin/ops/finance/expenses   — expense log
 * GET  /admin/ops/finance/expenses/{id}  — one expense
 * GET  /admin/ops/finance/expense-categories — the usual ones and every one added
 * POST /admin/ops/finance/expenses   — add expense
 * POST /admin/ops/finance/expenses/import — many at once (a Money Manager export); repeats are skipped
 * PUT  /admin/ops/finance/expenses/{id}  — edit expense
 * GET  /admin/ops/finance/projects/{id}  — a project's money: payments, AMC, expenses
 * PUT  /admin/ops/finance/payments/{id}  — update payment
 * DELETE /admin/ops/finance/payments/{id}
 * DELETE /admin/ops/finance/expenses/{id}
 * GET/POST /admin/ops/finance/other-income, PUT/DELETE /admin/ops/finance/other-income/{id}
 *   — money in that is not a project payment (a hackathon prize, a grant)
 */
class AdminOpsFinanceController
{
    /** The categories offered before any are added. Any other name can be added from the form. */
    private const EXPENSE_CATEGORIES = ['hosting','tools','travel','marketing','salary','pitch','other'];

    /** The AMC money a project's AMC brings: its price a year, what is due now, what was collected. */
    private const AMC_BY_PROJECT = "SELECT a.project_id,
                                           SUM(a.amount) AS amc_per_year,
                                           SUM(IF(DATEDIFF(IF(a.term_paid, a.renewal_date, a.start_date), CURDATE()) <= 30, a.amount, 0)) AS amc_due,
                                           MIN(IF(a.term_paid, a.renewal_date, a.start_date)) AS amc_next_due
                                      FROM ops_amc_records a WHERE a.tenant_id = ? GROUP BY a.project_id";

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
        // Every project, closed ones too: a closed project with money owed is still owed.
        $pendingAll = Database::fetch(
            "SELECT COALESCE(SUM(balance),0) AS total FROM ops_projects
             WHERE tenant_id = ? AND payment_status != 'paid'",
            [$tenantId]
        );
        $otherMonth = (float)Database::fetch(
            "SELECT COALESCE(SUM(amount),0) AS total FROM ops_other_income
             WHERE tenant_id = ? AND DATE_FORMAT(date,'%Y-%m') = ?",
            [$tenantId, $month]
        )['total'];
        $otherAll = (float)Database::fetch(
            'SELECT COALESCE(SUM(amount),0) AS total FROM ops_other_income WHERE tenant_id = ?',
            [$tenantId]
        )['total'];
        $amcMonth = Database::fetch(
            "SELECT COALESCE(SUM(amount),0) AS total FROM ops_payments
             WHERE tenant_id = ? AND type = 'amc' AND DATE_FORMAT(payment_date,'%Y-%m') = ?",
            [$tenantId, $month]
        );

        $byProject = Database::fetchAll(
            "SELECT p.id, p.project_code, p.name, p.stage, p.client_id, c.client_code, c.name AS client_name,
                    p.quoted, p.received, p.balance, p.payment_status,
                    CASE WHEN p.quoted > 0 THEN ROUND(p.received / p.quoted * 100, 1) ELSE 0 END AS pct_collected,
                    COALESCE(am.amc_per_year, 0) AS amc_per_year, COALESCE(am.amc_due, 0) AS amc_due, am.amc_next_due,
                    (SELECT COALESCE(SUM(x.amount),0) FROM ops_payments x WHERE x.tenant_id = p.tenant_id AND x.project_id = p.id AND x.type = 'amc') AS amc_collected,
                    (SELECT COALESCE(SUM(e.amount),0) FROM ops_expenses e WHERE e.tenant_id = p.tenant_id AND e.project_id = p.id) AS expenses
             FROM ops_projects p
             LEFT JOIN ops_clients c ON c.id = p.client_id AND c.tenant_id = p.tenant_id
             LEFT JOIN (" . self::AMC_BY_PROJECT . ") am ON am.project_id = p.id
             WHERE p.tenant_id = ?
             ORDER BY p.balance DESC, p.id DESC",
            [$tenantId, $tenantId]
        );
        foreach ($byProject as &$r) {
            foreach (['quoted','received','balance','pct_collected','amc_per_year','amc_due','amc_collected','expenses'] as $k) $r[$k] = (float)$r[$k];
            $r['id'] = (int)$r['id'];
            $r['client_id'] = $r['client_id'] !== null ? (int)$r['client_id'] : null;
        }
        unset($r);

        $revenue  = (float)$revenueMonth['total'];
        $amcIn    = (float)$amcMonth['total'];
        Response::success([
            'total_revenue_all_time' => (float)$revenueAll['total'] + $otherAll,
            'total_revenue_month'    => $revenue + $otherMonth,
            'total_collected_month'  => $revenue + $otherMonth,
            // Of the month's money in: project payments, AMC, and other income.
            'project_collected_month' => $revenue - $amcIn,
            'amc_collected_month'    => $amcIn,
            'other_income_month'     => $otherMonth,
            'total_pending'          => (float)$pendingAll['total'],
            // AMC due within 30 days or overdue, not collected yet.
            'amc_due'                => array_sum(array_column($byProject, 'amc_due')),
            'total_expenses_month'   => (float)$expensesMonth['total'],
            'net_profit_month'       => $revenue + $otherMonth - (float)$expensesMonth['total'],
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
                   LEFT JOIN ops_clients  c  ON c.id  = p.client_id  AND c.tenant_id  = p.tenant_id
                   LEFT JOIN ops_projects pr ON pr.id = p.project_id AND pr.tenant_id = p.tenant_id
                   WHERE p.tenant_id = ?";
        $params = [$tenantId];
        if ($projectId) { $sql .= ' AND p.project_id = ?';                   $params[] = $projectId; }
        if ($month)     { $sql .= " AND DATE_FORMAT(p.payment_date,'%Y-%m') = ?"; $params[] = $month; }
        $sql .= ' ORDER BY p.payment_date DESC, p.id DESC';
        Response::success(array_map([self::class, 'paymentRow'], Database::fetchAll($sql, $params)));
    }

    /** GET /admin/ops/finance/payments/{id} — the payment, its client and project, and its AMC if it paid one. */
    public function payment(Request $request): void
    {
        $tenantId = Database::tenantId();
        $row = Database::fetch(
            "SELECT p.*, c.name AS client_name, c.client_code, c.company AS client_company, c.phone AS client_phone,
                    pr.name AS project_name, pr.project_code, pr.quoted AS project_quoted, pr.received AS project_received,
                    pr.balance AS project_balance, pr.payment_status AS project_payment_status
               FROM ops_payments p
               LEFT JOIN ops_clients  c  ON c.id  = p.client_id  AND c.tenant_id  = p.tenant_id
               LEFT JOIN ops_projects pr ON pr.id = p.project_id AND pr.tenant_id = p.tenant_id
              WHERE p.id = ? AND p.tenant_id = ? LIMIT 1",
            [(int)$request->param('id'), $tenantId]
        ) ?? Response::error('Payment not found', 404);

        $data = self::paymentRow($row);
        foreach (['client_company','client_phone','project_payment_status'] as $k) $data[$k] = $row[$k] ?? null;
        foreach (['project_quoted','project_received','project_balance'] as $k) $data[$k] = $row[$k] !== null ? (float)$row[$k] : null;
        $data['amc'] = null;
        if ($row['type'] === 'amc' && !empty($row['amc_id'])) {
            $amc = OpsAmc::find((int)$row['amc_id'], $tenantId);
            if ($amc) {
                $data['amc'] = OpsAmc::format($amc);
                // Only the AMC's latest collection can be reverted (it puts the AMC back).
                $data['amc_current'] = (int)($amc['payment_id'] ?? 0) === (int)$row['id'];
            }
        }
        Response::success($data);
    }

    private static function paymentRow(array $r): array
    {
        $r['id']         = (int)$r['id'];
        $r['client_id']  = (int)$r['client_id'];
        $r['project_id'] = (int)$r['project_id'];
        $r['amount']     = (float)$r['amount'];
        $r['amc_id']     = !empty($r['amc_id']) ? (int)$r['amc_id'] : null;
        unset($r['amc_prev']);
        return $r;
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
            'recorded_by'  => trim((string)($body['recorded_by'] ?? '')) ?: (string)($request->user['name'] ?? ''),
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

        $sql    = self::EXPENSE_SELECT . ' WHERE e.tenant_id = ?';
        $params = [$tenantId];
        if ($category) { $sql .= ' AND e.category = ?';                    $params[] = $category; }
        if ($month)    { $sql .= " AND DATE_FORMAT(e.date,'%Y-%m') = ?";   $params[] = $month; }
        if ($request->query('project_id')) { $sql .= ' AND e.project_id = ?'; $params[] = (int)$request->query('project_id'); }
        $sql .= ' ORDER BY e.date DESC, e.expense_time DESC, e.id DESC';
        Response::success(array_map([self::class, 'expenseRow'], Database::fetchAll($sql, $params)));
    }

    private const EXPENSE_SELECT = "SELECT e.*, pr.name AS project_name, pr.project_code, pi.name AS pitch_name
                                      FROM ops_expenses e
                                      LEFT JOIN ops_projects pr ON pr.id = e.project_id AND pr.tenant_id = e.tenant_id
                                      LEFT JOIN ops_pitches  pi ON pi.id = e.pitch_id   AND pi.tenant_id = e.tenant_id";

    /** "14:30" or "14:30:00" as a time, else null. */
    private static function validTime(mixed $raw): ?string
    {
        $t = trim((string)$raw);
        if (!preg_match('/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/', $t, $m)) return null;
        return sprintf('%02d:%02d:00', (int)$m[1], (int)$m[2]);
    }

    /**
     * POST /admin/ops/finance/expenses/import — { rows: [{date, time?, category,
     * amount, description, notes?}], dry_run? }
     *
     * Adds each row as an expense. A row already there — same date, amount and
     * what-for — is skipped, so the same file can be imported again safely
     * (only what is new is added). dry_run says what would happen, adding nothing.
     */
    public function importExpenses(Request $request): void
    {
        $tenantId = Database::tenantId();
        $body     = $request->body();
        $rows     = is_array($body['rows'] ?? null) ? $body['rows'] : [];
        $dryRun   = !empty($body['dry_run']);
        if (!$rows) Response::error('Nothing to import', 422);
        if (count($rows) > 5000) Response::error('At most 5,000 rows at a time', 422);

        $key = fn(string $date, float $amount, string $what) => $date . '|' . number_format($amount, 2, '.', '') . '|' . mb_strtolower(trim(preg_replace('/\s+/', ' ', $what)));
        $seen = [];
        foreach (Database::fetchAll('SELECT date, amount, description FROM ops_expenses WHERE tenant_id = ?', [$tenantId]) as $e) {
            $seen[$key((string)$e['date'], (float)$e['amount'], (string)$e['description'])] = true;
        }

        $by = (string)($request->user['name'] ?? '');
        $added = 0; $addedAmount = 0.0; $skipped = [];
        if (!$dryRun) Database::beginTransaction();
        try {
            foreach ($rows as $i => $r) {
                $date   = OpsAmc::date($r['date'] ?? null);
                $amount = (float)str_replace([',', '₹', ' '], '', (string)($r['amount'] ?? '0'));
                $what   = mb_substr(trim((string)($r['description'] ?? '')), 0, 500);
                if (!$date)        { $skipped[] = ['row' => $i + 1, 'reason' => 'No valid date']; continue; }
                if ($amount <= 0)  { $skipped[] = ['row' => $i + 1, 'reason' => 'No amount']; continue; }
                $k = $key($date, $amount, $what);
                if (isset($seen[$k])) { $skipped[] = ['row' => $i + 1, 'reason' => 'Already there']; continue; }
                $seen[$k] = true;
                if (!$dryRun) {
                    Database::insert('ops_expenses', [
                        'tenant_id'    => $tenantId,
                        'category'     => self::validCategory($r['category'] ?? ''),
                        'amount'       => $amount,
                        'description'  => $what,
                        'notes'        => trim((string)($r['notes'] ?? '')) ?: null,
                        'date'         => $date,
                        'expense_time' => self::validTime($r['time'] ?? null),
                        'added_by'     => $by,
                    ]);
                }
                $added++;
                $addedAmount += $amount;
            }
            if (!$dryRun) Database::commit();
        } catch (\Throwable $e) {
            if (!$dryRun) Database::rollBack();
            throw $e;
        }

        Response::success([
            'added'        => $added,
            'added_amount' => $addedAmount,
            'skipped'      => $skipped,
            'dry_run'      => $dryRun,
        ], $dryRun ? 'Checked' : "Imported {$added} expense" . ($added === 1 ? '' : 's'));
    }

    private static function expenseRow(array $r): array
    {
        $r['id']         = (int)$r['id'];
        $r['amount']     = (float)$r['amount'];
        $r['project_id'] = !empty($r['project_id']) ? (int)$r['project_id'] : null;
        $r['pitch_id']   = !empty($r['pitch_id']) ? (int)$r['pitch_id'] : null;
        $r['notes']      = $r['notes'] ?? null;
        $r['time']       = !empty($r['expense_time']) ? substr((string)$r['expense_time'], 0, 5) : null;
        unset($r['expense_time']);
        return $r;
    }

    /** GET /admin/ops/finance/expenses/{id} */
    public function expense(Request $request): void
    {
        $row = Database::fetch(self::EXPENSE_SELECT . ' WHERE e.id = ? AND e.tenant_id = ? LIMIT 1',
            [(int)$request->param('id'), Database::tenantId()]) ?? Response::error('Expense not found', 404);
        Response::success(self::expenseRow($row));
    }

    /** GET /admin/ops/finance/expense-categories — the usual categories, then every other one used, a-z. */
    public function expenseCategories(Request $request): void
    {
        $used = array_column(Database::fetchAll(
            "SELECT DISTINCT TRIM(category) AS category FROM ops_expenses WHERE tenant_id = ? AND TRIM(category) <> '' ORDER BY category",
            [Database::tenantId()]
        ), 'category');
        $out = self::EXPENSE_CATEGORIES;
        $seen = array_flip(array_map('mb_strtolower', $out));
        foreach ($used as $c) {
            if (!isset($seen[mb_strtolower($c)])) { $out[] = $c; $seen[mb_strtolower($c)] = true; }
        }
        Response::success($out);
    }

    /** A category as typed, or one of the usual ones however it was cased. */
    private static function validCategory(mixed $raw): string
    {
        $c = mb_substr(trim(preg_replace('/\s+/', ' ', (string)$raw)), 0, 60);
        if ($c === '') return 'other';
        foreach (self::EXPENSE_CATEGORIES as $known) if (mb_strtolower($c) === $known) return $known;
        // An earlier spelling of the same new category wins, so one category is not two.
        $same = Database::fetch('SELECT category FROM ops_expenses WHERE tenant_id = ? AND LOWER(category) = LOWER(?) LIMIT 1', [Database::tenantId(), $c]);
        return $same ? (string)$same['category'] : $c;
    }

    /** PUT /admin/ops/finance/expenses/{id} — any field. */
    public function updateExpense(Request $request): void
    {
        $id       = (int)$request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();
        Database::fetch('SELECT id FROM ops_expenses WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId])
            ?? Response::error('Expense not found', 404);

        $updates = [];
        if (isset($body['amount'])) {
            if ((float)$body['amount'] <= 0) Response::error('Amount must be positive', 422);
            $updates['amount'] = (float)$body['amount'];
        }
        if (isset($body['category']))    $updates['category']    = self::validCategory($body['category']);
        if (isset($body['description'])) $updates['description'] = trim((string)$body['description']);
        if (array_key_exists('notes', $body)) $updates['notes']  = trim((string)$body['notes']) ?: null;
        if (array_key_exists('project_id', $body)) $updates['project_id'] = !empty($body['project_id']) ? (int)$body['project_id'] : null;
        if (!empty($body['date']))       $updates['date']        = $body['date'];
        if (array_key_exists('time', $body)) $updates['expense_time'] = self::validTime($body['time']);
        if (isset($body['added_by']))    $updates['added_by']    = trim((string)$body['added_by']);
        if ($updates) Database::update('ops_expenses', $updates, ['id' => $id, 'tenant_id' => $tenantId]);

        $row = Database::fetch(self::EXPENSE_SELECT . ' WHERE e.id = ? AND e.tenant_id = ? LIMIT 1', [$id, $tenantId]);
        Response::success(self::expenseRow($row), 'Expense updated');
    }

    /**
     * GET /admin/ops/finance/projects/{id} — a project's money in one place:
     * quoted, received and balance, each payment, its AMC and AMC payments, and
     * the expenses booked against it.
     */
    public function project(Request $request): void
    {
        $id       = (int)$request->param('id');
        $tenantId = Database::tenantId();
        $p = Database::fetch(
            "SELECT p.*, c.name AS client_name, c.client_code, c.company AS client_company
               FROM ops_projects p
               LEFT JOIN ops_clients c ON c.id = p.client_id AND c.tenant_id = p.tenant_id
              WHERE p.id = ? AND p.tenant_id = ? LIMIT 1",
            [$id, $tenantId]
        ) ?? Response::error('Project not found', 404);

        $payments = array_map([self::class, 'paymentRow'], Database::fetchAll(
            'SELECT * FROM ops_payments WHERE tenant_id = ? AND project_id = ? ORDER BY payment_date DESC, id DESC',
            [$tenantId, $id]
        ));
        $expenses = array_map([self::class, 'expenseRow'], Database::fetchAll(
            self::EXPENSE_SELECT . ' WHERE e.tenant_id = ? AND e.project_id = ? ORDER BY e.date DESC, e.id DESC',
            [$tenantId, $id]
        ));
        $amcs = array_map([OpsAmc::class, 'format'], Database::fetchAll(OpsAmc::SELECT . ' WHERE a.project_id = ? AND a.tenant_id = ? ORDER BY a.id', [$id, $tenantId]));

        $amcIn  = array_sum(array_map(fn($x) => $x['type'] === 'amc' ? $x['amount'] : 0, $payments));
        $spent  = array_sum(array_column($expenses, 'amount'));
        $received = (float)$p['received'];
        Response::success([
            'id'             => (int)$p['id'],
            'project_code'   => $p['project_code'] ?? null,
            'name'           => $p['name'],
            'stage'          => $p['stage'],
            'client_id'      => (int)$p['client_id'],
            'client_name'    => $p['client_name'],
            'client_code'    => $p['client_code'],
            'client_company' => $p['client_company'],
            'quoted'         => (float)$p['quoted'],
            'received'       => $received,
            'balance'        => (float)$p['balance'],
            'payment_status' => $p['payment_status'],
            'pct_collected'  => (float)$p['quoted'] > 0 ? round($received / (float)$p['quoted'] * 100, 1) : 0,
            'amc_collected'  => $amcIn,
            'amc_per_year'   => array_sum(array_column($amcs, 'amount')),
            'expenses_total' => $spent,
            // What the project has brought in, less what was spent on it.
            'net'            => $received + $amcIn - $spent,
            'payments'       => $payments,
            'amcs'           => $amcs,
            'expenses'       => $expenses,
        ]);
    }

    public function addExpense(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();
        $amount   = (float)($body['amount'] ?? 0);

        if ($amount <= 0) Response::error('Amount must be positive', 422);

        $id = Database::insert('ops_expenses', [
            'tenant_id'   => $tenantId,
            'category'    => self::validCategory($body['category'] ?? ''),
            'amount'      => $amount,
            'description' => trim((string)($body['description'] ?? '')),
            'notes'       => trim((string)($body['notes'] ?? '')) ?: null,
            'project_id'  => !empty($body['project_id']) ? (int)$body['project_id'] : null,
            'pitch_id'    => !empty($body['pitch_id'])   ? (int)$body['pitch_id']   : null,
            'date'        => !empty($body['date']) ? $body['date'] : date('Y-m-d'),
            'expense_time' => self::validTime($body['time'] ?? null),
            'added_by'    => trim((string)($body['added_by'] ?? '')) ?: (string)($request->user['name'] ?? ''),
        ]);

        $row = Database::fetch(self::EXPENSE_SELECT . ' WHERE e.id = ? LIMIT 1', [$id]);
        Response::success(self::expenseRow($row), 'Expense recorded', 201);
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

        // If it was an AMC's latest collection, the AMC goes back to how it was before
        if ((string)($pay['type'] ?? '') === 'amc') AdminOpsAmcController::paymentRemoved($tenantId, $id, (string)($request->user['name'] ?? ''));

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

    /** GET /admin/ops/finance/other-income — newest first; ?month=YYYY-MM for one month. */
    public function otherIncome(Request $request): void
    {
        $sql    = 'SELECT * FROM ops_other_income WHERE tenant_id = ?';
        $params = [Database::tenantId()];
        if ($month = $request->query('month')) { $sql .= " AND DATE_FORMAT(date,'%Y-%m') = ?"; $params[] = $month; }
        $sql .= ' ORDER BY date DESC, id DESC';
        Response::success(array_map([self::class, 'otherIncomeRow'], Database::fetchAll($sql, $params)));
    }

    /** POST /admin/ops/finance/other-income — {date, amount, source, notes?} */
    public function addOtherIncome(Request $request): void
    {
        $id = Database::insert('ops_other_income', [
            'tenant_id' => Database::tenantId(),
            'added_by'  => (string)($request->user['name'] ?? ''),
        ] + self::otherIncomeFields($request->body(), null));
        $row = Database::fetch('SELECT * FROM ops_other_income WHERE id = ? LIMIT 1', [$id]);
        Response::success(self::otherIncomeRow($row), 'Income recorded', 201);
    }

    /** PUT /admin/ops/finance/other-income/{id} */
    public function updateOtherIncome(Request $request): void
    {
        $id       = (int)$request->param('id');
        $tenantId = Database::tenantId();
        $current  = Database::fetch('SELECT * FROM ops_other_income WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId])
            ?: Response::error('Income not found', 404);
        Database::update('ops_other_income', self::otherIncomeFields($request->body(), $current), ['id' => $id, 'tenant_id' => $tenantId]);
        $row = Database::fetch('SELECT * FROM ops_other_income WHERE id = ? LIMIT 1', [$id]);
        Response::success(self::otherIncomeRow($row), 'Income updated');
    }

    /** DELETE /admin/ops/finance/other-income/{id} */
    public function deleteOtherIncome(Request $request): void
    {
        $id       = (int)$request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_other_income WHERE id = ? AND tenant_id = ?', [$id, $tenantId])
            ?: Response::error('Income not found', 404);
        Database::query('DELETE FROM ops_other_income WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(['message' => 'Income deleted']);
    }

    /** Other income's fields from a request body; a field left out keeps its current value. */
    private static function otherIncomeFields(array $body, ?array $current): array
    {
        $amount = array_key_exists('amount', $body) ? (float)$body['amount'] : (float)($current['amount'] ?? 0);
        $source = array_key_exists('source', $body) ? mb_substr(trim((string)$body['source']), 0, 150) : (string)($current['source'] ?? '');
        $date   = array_key_exists('date', $body) ? OpsAmc::date($body['date']) : ($current['date'] ?? date('Y-m-d'));
        if ($amount <= 0)   Response::error('Amount must be positive', 422);
        if ($source === '') Response::error('Say where the money came from', 422);
        if (!$date)         Response::error('Date is not valid', 422);
        return [
            'date'   => $date,
            'amount' => $amount,
            'source' => $source,
            'notes'  => array_key_exists('notes', $body) ? (trim((string)$body['notes']) ?: null) : ($current['notes'] ?? null),
        ];
    }

    private static function otherIncomeRow(array $r): array
    {
        return [
            'id'         => (int)$r['id'],
            'date'       => $r['date'],
            'amount'     => (float)$r['amount'],
            'source'     => $r['source'],
            'notes'      => $r['notes'],
            'added_by'   => $r['added_by'],
            'created_at' => $r['created_at'],
        ];
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
