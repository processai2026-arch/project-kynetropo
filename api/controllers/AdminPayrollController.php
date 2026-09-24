<?php
declare(strict_types=1);

/**
 * Admin Payroll Controller
 * GET  /admin/payroll                         — fetch payroll for a month (?month=YYYY-MM)
 * GET  /admin/payroll/report                  — month totals (employee count, sum net_pay, etc.)
 * GET  /admin/payroll/settings                — statutory rate configuration (PF/ESI/PT/TDS)
 * PUT  /admin/payroll/settings                — update statutory rate configuration
 * GET  /admin/payroll/run-status               — maker-checker lifecycle state for a month
 * GET  /admin/payroll/{id}                    — single payroll slip by payroll_id
 * GET  /admin/payroll/{id}/history            — full payroll history for an employee
 * POST /admin/payroll/calculate               — preview calc WITHOUT persisting
 * POST /admin/payroll/run                     — ONE-CLICK: compute + persist for the whole period (re-run safe while draft)
 * POST /admin/payroll/review                  — maker-checker: draft -> reviewed
 * POST /admin/payroll/approve                 — maker-checker: reviewed -> approved (must be a different admin from reviewer)
 * POST /admin/payroll/pay                     — approved -> paid
 * POST /admin/payroll/lock                    — paid -> locked (immutable from here)
 * POST /admin/payroll/process                 — legacy alias retained for compatibility (maps to approve/pay)
 * GET  /admin/payroll/bank-advice              — downloadable bank disbursement CSV for a processed/paid month
 */
class AdminPayrollController
{
    // ─── GET /admin/payroll ───────────────────────────────────────────────────

    public function index(Request $request): void
    {
        $month = $request->query('month') ?? date('Y-m');
        $rows  = Payroll::forMonth($month);
        Response::success(array_map([Payroll::class, 'format'], $rows));
    }

    // ─── GET /admin/payroll/settings — statutory rate configuration ──────────

    public function settingsShow(Request $request): void
    {
        Response::success(Payroll::getSettings());
    }

    // ─── PUT /admin/payroll/settings ──────────────────────────────────────────

    public function settingsUpdate(Request $request): void
    {
        $input = $request->only([
            'pfEnabled', 'pfPercent', 'pfEmployerPercent', 'pfWageCeiling',
            'esiEnabled', 'esiPercent', 'esiEmployerPercent', 'esiWageCeiling',
            'ptEnabled', 'ptSlabs',
            'tdsEnabled', 'tdsPercent', 'tdsAnnualThreshold',
        ]);
        if (empty($input)) {
            Response::error('Provide at least one statutory setting to update', 422);
        }
        Response::success(Payroll::updateSettings($input), 'Payroll statutory settings updated');
    }

    // ─── GET /admin/payroll/run-status — lifecycle state for a month ─────────

    public function runStatus(Request $request): void
    {
        $month = trim((string)($request->query('month') ?? date('Y-m')));
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            Response::error('Valid month required (YYYY-MM)', 422);
        }

        $run = PayrollRun::find($month);
        if (!$run) {
            Response::success(['month' => $month, 'exists' => false, 'runStatus' => null]);
        }

        $names = PayrollRun::actorNames([
            $run['created_by'] ?? null, $run['reviewed_by'] ?? null,
            $run['approved_by'] ?? null, $run['paid_by'] ?? null, $run['locked_by'] ?? null,
        ]);

        Response::success(['exists' => true] + PayrollRun::format($run, $names));
    }

    // ─── POST /admin/payroll/ai-check — pre-run anomaly audit ────────────────
    // Compares this month's generated payroll against each employee's OWN recent
    // history and flags rows that look wrong BEFORE you process/pay. Only payroll
    // figures + employee IDs (not names) are sent to the AI.
    public function aiCheck(Request $request): void
    {
        $month = trim((string)($request->input('month') ?? $request->query('month') ?? date('Y-m')));
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            Response::error('Valid month required (YYYY-MM)', 422);
        }

        $rows = Payroll::forMonth($month);
        if (empty($rows)) {
            Response::error("No payroll generated for {$month}. Run payroll first.", 422);
        }

        // Per-employee baseline from up to 3 prior months.
        $keys = array_values(array_unique(array_map(fn($r) => (string)$r['employee_key'], $rows)));
        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $history = Database::fetchAll(
            "SELECT employee_key, month, net_pay, overtime_hrs, pf, professional_tax, deductions, base_salary
             FROM payroll
             WHERE tenant_id = ? AND month < ? AND employee_key IN ($placeholders)
             ORDER BY employee_key ASC, month DESC",
            array_merge([Database::tenantId(), $month], $keys)
        );
        $baseline = [];
        foreach ($history as $h) {
            $k = (string)$h['employee_key'];
            if (!isset($baseline[$k])) $baseline[$k] = [];
            if (count($baseline[$k]) < 3) $baseline[$k][] = $h;
        }

        $avg = static fn(array $list, string $f) => $list ? round(array_sum(array_map(fn($x) => (float)$x[$f], $list)) / count($list), 2) : null;

        $facts = [];
        foreach ($rows as $r) {
            $k = (string)$r['employee_key'];
            $hist = $baseline[$k] ?? [];
            $net = (float)$r['net_pay'];
            $avgNet = $avg($hist, 'net_pay');
            $facts[] = [
                'employee_key'     => $k,
                'present_days'     => (float)$r['present_days'],
                'working_days'     => (int)$r['working_days'],
                'base_salary'      => (float)$r['base_salary'],
                'overtime_hrs'     => (float)($r['overtime_hrs'] ?? 0),
                'overtime_salary'  => (float)($r['overtime_salary'] ?? 0),
                'pf'               => (float)$r['pf'],
                'professional_tax' => (float)$r['professional_tax'],
                'deductions'       => (float)$r['deductions'],
                'deducted_advance' => (float)($r['deducted_advance'] ?? 0),
                'net_pay'          => $net,
                'baseline'         => [
                    'months'           => count($hist),
                    'avg_net_pay'      => $avgNet,
                    'avg_overtime_hrs' => $avg($hist, 'overtime_hrs'),
                    'avg_pf'           => $avg($hist, 'pf'),
                    'last_net_pay'     => $hist ? (float)$hist[0]['net_pay'] : null,
                ],
                'net_pay_change_pct' => ($avgNet && $avgNet > 0) ? round(($net - $avgNet) / $avgNet * 100, 1) : null,
            ];
        }

        $system = 'You are a meticulous payroll auditor for an Indian manufacturer. You are given this month\'s '
            . 'payroll rows (INR) with each employee\'s own recent baseline. Flag ONLY rows that look wrong and '
            . 'should be checked BEFORE payment. Look for: net pay swinging sharply vs baseline; overtime far above '
            . 'the employee\'s norm; statutory deduction (pf/professional_tax) zero/missing when their history had it; '
            . 'negative or zero net pay; present_days greater than working_days; advance deduction spikes. '
            . 'Ignore normal variation and brand-new employees with no history. Reply with STRICT JSON only: '
            . '{"overall":"<one sentence verdict>","flags":[{"employee_key":"<id>","severity":"high|medium|low",'
            . '"issue":"<short label>","detail":"<one line citing the numbers>"}]}. No markdown, no prose.';

        try {
            $resp = GroqAPI::chat([
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => 'Month ' . $month . ' payroll:\n' . json_encode($facts, JSON_UNESCAPED_UNICODE)],
            ], 'llama-3.3-70b-versatile', 0.2);
            $ai = GroqAPI::extractJSON($resp);
        } catch (\Throwable $e) {
            error_log('Payroll AI check failed: ' . $e->getMessage());
            Response::error('AI check is unavailable right now. Please try again shortly.', 502);
        }

        // Validate flags against real rows + attach names for display.
        $nameByKey = [];
        foreach ($rows as $r) { $nameByKey[(string)$r['employee_key']] = $r['employee_name'] ?? null; }
        $validKeys = array_keys($nameByKey);
        $flags = [];
        foreach ((array)($ai['flags'] ?? []) as $f) {
            $key = (string)($f['employee_key'] ?? '');
            $sev = strtolower((string)($f['severity'] ?? 'low'));
            if (!in_array($key, $validKeys, true)) continue;
            if (!in_array($sev, ['high', 'medium', 'low'], true)) $sev = 'low';
            $flags[] = [
                'employee_key'  => $key,
                'employee_name' => $nameByKey[$key] ?? null,
                'severity'      => $sev,
                'issue'         => is_string($f['issue'] ?? null) ? trim($f['issue']) : '',
                'detail'        => is_string($f['detail'] ?? null) ? trim($f['detail']) : '',
            ];
        }
        $order = ['high' => 0, 'medium' => 1, 'low' => 2];
        usort($flags, fn($a, $b) => $order[$a['severity']] <=> $order[$b['severity']]);

        Response::success([
            'month'        => $month,
            'checked'      => count($rows),
            'overall'      => is_string($ai['overall'] ?? null) ? trim($ai['overall']) : '',
            'flags'        => $flags,
            'flagged'      => count($flags),
            'high'         => count(array_filter($flags, fn($f) => $f['severity'] === 'high')),
            'generated_at' => date('Y-m-d H:i:s'),
        ], 'Payroll checked');
    }

    // ─── POST /admin/payroll/run — ONE-CLICK "Run payroll for period" ────────
    // Computes every active employee's payslip from attendance + salary data and
    // persists it in a single action. Creates (or reuses) the draft payroll run.
    // Blocked once the month's run has moved past draft.

    public function run(Request $request): void
    {
        $month = trim((string)$request->input('month', ''));
        if (!$month || !preg_match('/^\d{4}-\d{2}$/', $month)) {
            Response::error('Valid month required (YYYY-MM)', 422);
        }

        $existingRun = PayrollRun::find($month);
        if ($existingRun && $existingRun['run_status'] !== 'draft') {
            Response::error("Payroll for {$month} is already '{$existingRun['run_status']}'. Locked/processed runs cannot be recomputed.", 409);
        }

        $workingDays = $this->resolveWorkingDays($request, $month);
        $manualOvertimeHours = $this->resolveOvertimeHours($request);
        $advanceTotals = EmployeeAdvance::totalsForMonth($month);
        $settings = Payroll::getSettings();

        $employees = Database::fetchAll('SELECT * FROM employees WHERE is_active = 1 AND tenant_id = ?', [Database::tenantId()]);

        $userId = (int)($request->user['user_id'] ?? 0);
        PayrollRun::ensureDraft($month, $userId, $workingDays);

        foreach ($employees as $emp) {
            $entries = Database::fetchAll(
                "SELECT * FROM attendance
                  WHERE employee_key = ? AND tenant_id = ?
                    AND DATE_FORMAT(date, '%Y-%m') = ?",
                [$emp['employee_key'], Database::tenantId(), $month]
            );
            $slip = $this->buildSlip(
                $emp,
                $entries,
                $month,
                $workingDays,
                $manualOvertimeHours,
                $advanceTotals,
                $settings
            );

            Payroll::upsert([
                'employeeKey'     => $emp['employee_key'],
                'month'           => $month,
                'workingDays'     => $slip['workingDays'],
                'presentDays'     => $slip['presentDays'],
                'salaryPerDay'    => $slip['salaryPerDay'],
                'leaves'          => $slip['leaves'],
                'leaveAvailedThisMonth' => $slip['leaveAvailedThisMonth'],
                'leaveSalary'     => $slip['leaveSalary'],
                'travelAllow'     => $slip['travelAllow'],
                'baseSalary'      => $slip['baseSalary'],
                'siteAllowance'   => $slip['siteAllowance'],
                'da'              => $slip['da'],
                'foodAllowance'   => $slip['foodAllowance'],
                'totalSalay'      => $slip['totalSalay'],
                'earnedSalary'    => $slip['earnedSalary'],
                'attendBonus'     => $slip['attendBonus'],
                'salaryAdvancePaid' => $slip['salaryAdvancePaid'],
                'deductedAdvance' => $slip['deductedAdvance'],
                'overtimeRate'    => $slip['overtimeRate'],
                'overtimeHours'   => $slip['overtimeHours'],
                'overtimeSalary'  => $slip['overtimeSalary'],
                'totalSalary'     => $slip['totalSalary'],
                'hra'             => $slip['hra'],
                'allowances'      => $slip['allowances'],
                'grossPay'        => $slip['grossPay'],
                'pf'              => $slip['pf'],
                'esi'             => $slip['esi'],
                'employerPf'      => $slip['employerPf'],
                'employerEsi'     => $slip['employerEsi'],
                'professionalTax' => $slip['professionalTax'],
                'tds'             => $slip['tds'],
                'deductions'      => $slip['deductions'],
                'netPay'          => $slip['netPay'],
                'bankAccountHolder' => $slip['bankAccountHolder'],
                'bankAccountNumber' => $slip['bankAccountNumber'],
                'bankIfsc'          => $slip['bankIfsc'],
                'bankName'          => $slip['bankNameVal'],
            ]);
        }

        PayrollRun::refreshTotals($month, $workingDays);

        $result = Payroll::forMonth($month);
        Response::success(array_map([Payroll::class, 'format'], $result), 'Payroll computed for ' . count($employees) . ' employees');
    }

    // ─── GET /admin/payroll/{id} ─────────────────────────────────────────────

    public function show(Request $request): void
    {
        $id = (int)$request->param('id');
        $row = Database::fetch(
            'SELECT p.*, e.name AS employee_name, e.designation, e.joined_at
               FROM payroll p
               JOIN employees e ON p.employee_key = e.employee_key AND e.tenant_id = p.tenant_id
              WHERE p.payroll_id = ? AND p.tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
        if (!$row) Response::error('Payroll slip not found', 404);
        Response::success(Payroll::format($row));
    }

    // ─── GET /admin/payroll/{employee_id}/history ────────────────────────────

    public function history(Request $request): void
    {
        $empId = $request->param('id');
        $emp   = Employee::findByKey($empId);
        if (!$emp) Response::error('Employee not found', 404);

        $rows = Database::fetchAll(
            'SELECT p.*, e.name AS employee_name, e.designation, e.joined_at
               FROM payroll p
               JOIN employees e ON p.employee_key = e.employee_key AND e.tenant_id = p.tenant_id
              WHERE p.employee_key = ? AND p.tenant_id = ?
              ORDER BY p.month DESC',
            [$empId, Database::tenantId()]
        );

        Response::success(array_map([Payroll::class, 'format'], $rows));
    }

    // ─── POST /admin/payroll/calculate ───────────────────────────────────────

    public function calculate(Request $request): void
    {
        $month = trim((string)$request->input('month', ''));
        if (!$month || !preg_match('/^\d{4}-\d{2}$/', $month)) {
            Response::error('Valid month required (YYYY-MM)', 422);
        }

        $workingDays = $this->resolveWorkingDays($request, $month);
        $manualOvertimeHours = $this->resolveOvertimeHours($request);
        $advanceTotals = EmployeeAdvance::totalsForMonth($month);
        $settings = Payroll::getSettings();

        $employees = Database::fetchAll('SELECT * FROM employees WHERE is_active = 1 AND tenant_id = ?', [Database::tenantId()]);
        $slips     = [];

        foreach ($employees as $emp) {
            $entries = Database::fetchAll(
                "SELECT * FROM attendance
                  WHERE employee_key = ? AND tenant_id = ?
                    AND DATE_FORMAT(date, '%Y-%m') = ?",
                [$emp['employee_key'], Database::tenantId(), $month]
            );
            $slips[] = $this->buildSlip(
                $emp,
                $entries,
                $month,
                $workingDays,
                $manualOvertimeHours,
                $advanceTotals,
                $settings
            );
        }

        Response::success($slips, 'Preview (not saved)');
    }

    // ─── Maker-checker lifecycle actions ──────────────────────────────────────
    // draft -> reviewed -> approved -> paid -> locked. Each step requires an
    // authenticated admin; approve requires a DIFFERENT admin from whoever
    // reviewed, enforcing a real maker-checker control (not a single click-through).

    public function review(Request $request): void
    {
        $this->transitionAction($request, 'reviewed', null, false);
    }

    public function approve(Request $request): void
    {
        $this->transitionAction($request, 'approved', 'reviewed_by', true);
    }

    public function pay(Request $request): void
    {
        $this->transitionAction($request, 'paid', null, false);
    }

    public function lock(Request $request): void
    {
        $this->transitionAction($request, 'locked', null, false);
    }

    private function transitionAction(Request $request, string $toStatus, ?string $distinctFromField, bool $enforceDistinct): void
    {
        $month = trim((string)$request->input('month', ''));
        $note  = $request->input('note') !== null ? trim((string)$request->input('note')) : null;
        if (!$month || !preg_match('/^\d{4}-\d{2}$/', $month)) {
            Response::error('Valid month required (YYYY-MM)', 422);
        }

        $userId = (int)($request->user['user_id'] ?? 0);
        if ($userId <= 0) Response::error('Authenticated admin required', 401);

        $requireDistinctFrom = null;
        if ($enforceDistinct && $distinctFromField) {
            $run = PayrollRun::find($month);
            $requireDistinctFrom = $run && isset($run[$distinctFromField]) ? (int)$run[$distinctFromField] : null;
        }

        try {
            $run = PayrollRun::transition($month, $toStatus, $userId, $note, $requireDistinctFrom);
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 409);
        }

        $names = PayrollRun::actorNames([
            $run['created_by'] ?? null, $run['reviewed_by'] ?? null,
            $run['approved_by'] ?? null, $run['paid_by'] ?? null, $run['locked_by'] ?? null,
        ]);

        $slips = Payroll::forMonth($month);
        Response::success([
            'run'   => PayrollRun::format($run, $names),
            'slips' => array_map([Payroll::class, 'format'], $slips),
        ], "Payroll run for {$month} moved to '{$toStatus}'");
    }

    // ─── POST /admin/payroll/process — legacy alias ──────────────────────────
    // Older frontend builds call this with status=Processed|Paid. Maps onto the
    // new lifecycle so existing integrations keep working without exposing a
    // second source of truth.

    public function process(Request $request): void
    {
        $month  = trim((string)$request->input('month', ''));
        $status = trim((string)$request->input('status', 'Processed'));

        if (!$month || !preg_match('/^\d{4}-\d{2}$/', $month)) {
            Response::error('Valid month required (YYYY-MM)', 422);
        }
        if (!in_array($status, ['Processed', 'Paid'], true)) {
            Response::error('Status must be Processed or Paid', 422);
        }

        $userId = (int)($request->user['user_id'] ?? 0);
        $run = PayrollRun::find($month);
        if (!$run) {
            Response::error("No payroll run exists for {$month}. Run payroll first.", 422);
        }

        try {
            $current = (string)$run['run_status'];
            if ($status === 'Processed') {
                if ($current === 'draft') $run = PayrollRun::transition($month, 'reviewed', $userId);
                if (($run['run_status'] ?? $current) === 'reviewed') $run = PayrollRun::transition($month, 'approved', $userId);
            } else { // Paid
                if ($current === 'draft') $run = PayrollRun::transition($month, 'reviewed', $userId);
                if (($run['run_status'] ?? '') === 'reviewed') $run = PayrollRun::transition($month, 'approved', $userId);
                if (($run['run_status'] ?? '') === 'approved') $run = PayrollRun::transition($month, 'paid', $userId);
            }
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 409);
        }

        $result = Payroll::forMonth($month);
        Response::success([
            'month'    => $month,
            'status'   => $status,
            'runStatus' => $run['run_status'] ?? null,
            'slips'    => array_map([Payroll::class, 'format'], $result),
        ], "Payroll marked $status");
    }

    // ─── GET /admin/payroll/bank-advice — salary disbursement CSV ────────────
    // One-click downloadable bank file: account holder, account number, IFSC,
    // bank name, and net pay per employee — exactly what a bank's bulk-upload
    // template needs, with no manual transcription from payslips.

    public function bankAdvice(Request $request): void
    {
        $month = trim((string)($request->query('month') ?? ''));
        if (!$month || !preg_match('/^\d{4}-\d{2}$/', $month)) {
            Response::error('Valid month required (YYYY-MM)', 422);
        }

        $run = PayrollRun::find($month);
        if (!$run) {
            Response::error("No payroll run exists for {$month}. Run payroll first.", 422);
        }
        if (in_array($run['run_status'], ['draft', 'reviewed'], true)) {
            Response::error("Payroll for {$month} must be approved before generating a bank advice (current status: {$run['run_status']}).", 409);
        }

        $rows = Payroll::forMonth($month);
        if (empty($rows)) {
            Response::error("No payroll rows found for {$month}.", 422);
        }

        $userId = (int)($request->user['user_id'] ?? 0);
        $total = 0.0;
        $missingBank = 0;

        $lines = [];
        $lines[] = implode(',', [
            'Employee ID', 'Employee Name', 'Bank Account Holder', 'Account Number',
            'IFSC Code', 'Bank Name', 'Net Pay (INR)', 'Month',
        ]);

        foreach ($rows as $r) {
            $netPay = (float)$r['net_pay'];
            $total += $netPay;
            $holder = $r['bank_account_holder'] ?: $r['employee_name'];
            $acct   = $r['bank_account_number'] ?: '';
            $ifsc   = $r['bank_ifsc'] ?: '';
            $bank   = $r['bank_name'] ?: '';
            if ($acct === '' || $ifsc === '') $missingBank++;

            $lines[] = implode(',', array_map([$this, 'csvEscape'], [
                $r['employee_key'], $r['employee_name'], $holder, $acct, $ifsc, $bank,
                number_format($netPay, 2, '.', ''), $month,
            ]));
        }

        PayrollRun::recordBankAdvice($month, $userId, count($rows), round($total, 2));

        $csv = implode("\r\n", $lines) . "\r\n";
        $filename = "bank-advice-{$month}.csv";

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($csv));
        if ($missingBank > 0) {
            header('X-Bank-Advice-Missing-Details: ' . $missingBank);
        }
        echo $csv;
        exit;
    }

    private function csvEscape(mixed $value): string
    {
        $value = (string)$value;
        if (preg_match('/[",\r\n]/', $value)) {
            $value = '"' . str_replace('"', '""', $value) . '"';
        }
        return $value;
    }

    // ─── GET /admin/payroll/report ───────────────────────────────────────────

    public function report(Request $request): void
    {
        $month = $request->query('month') ?? date('Y-m');
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            Response::error('Valid month required (YYYY-MM)', 422);
        }

        $summary = Database::fetch(
            "SELECT COUNT(*) AS employees,
                    SUM(earned_salary)    AS total_earned,
                    SUM(overtime_salary)  AS total_overtime,
                    SUM(hra)              AS total_hra,
                    SUM(allowances)       AS total_allowances,
                    SUM(gross_pay)        AS total_gross,
                    SUM(pf)               AS total_pf,
                    SUM(esi)              AS total_esi,
                    SUM(professional_tax) AS total_pt,
                    SUM(tds)              AS total_tds,
                    SUM(deductions)       AS total_deductions,
                    SUM(net_pay)          AS total_net_pay
             FROM payroll WHERE month = ? AND tenant_id = ?",
            [$month, Database::tenantId()]
        );

        $statusBreakdown = Database::fetchAll(
            "SELECT run_status, COUNT(*) AS count
             FROM payroll WHERE month = ? AND tenant_id = ?
             GROUP BY run_status",
            [$month, Database::tenantId()]
        );

        Response::success([
            'month'   => $month,
            'summary' => [
                'employees'        => (int)($summary['employees']         ?? 0),
                'totalEarned'      => (float)($summary['total_earned']      ?? 0),
                'totalOvertime'    => (float)($summary['total_overtime']    ?? 0),
                'totalHra'         => (float)($summary['total_hra']         ?? 0),
                'totalAllowances'  => (float)($summary['total_allowances']  ?? 0),
                'totalGross'       => (float)($summary['total_gross']       ?? 0),
                'totalPf'          => (float)($summary['total_pf']          ?? 0),
                'totalEsi'         => (float)($summary['total_esi']         ?? 0),
                'totalProfessionalTax' => (float)($summary['total_pt']      ?? 0),
                'totalTds'         => (float)($summary['total_tds']         ?? 0),
                'totalDeductions'  => (float)($summary['total_deductions']  ?? 0),
                'totalNetPay'      => (float)($summary['total_net_pay']     ?? 0),
            ],
            'byStatus' => array_map(fn($r) => [
                'status' => $r['run_status'],
                'count'  => (int)$r['count'],
            ], $statusBreakdown),
        ]);
    }

    // ─── private ─────────────────────────────────────────────────────────────

    private function buildSlip(
        array $emp,
        array $entries,
        string $month,
        int $workingDays,
        array $manualOvertimeHours = [],
        array $advanceTotals = [],
        ?array $settings = null
    ): array {
        $settings ??= Payroll::getSettings();

        $dayFractions = [];
        $dayLeaves = [];

        foreach ($entries as $entry) {
            $date = (string)($entry['date'] ?? '');
            if (($entry['status'] ?? '') === 'Present') {
                $dayFractions[$date] = ($dayFractions[$date] ?? 0) + 1;
            } elseif (($entry['status'] ?? '') === 'Half-day') {
                $dayFractions[$date] = ($dayFractions[$date] ?? 0) + 0.5;
            } elseif (($entry['status'] ?? '') === 'Leave') {
                $dayLeaves[$date] = true;
            }
        }

        $present = 0.0;
        foreach ($dayFractions as $date => $fraction) {
            if ($date !== '') $present += min(1.0, (float)$fraction);
        }
        $leaves = 0;
        foreach ($dayLeaves as $date => $_) {
            if (!isset($dayFractions[$date]) || $dayFractions[$date] <= 0) $leaves++;
        }

        $baseSalary = round(max(0, (float)($emp['base_salary'] ?? 0)), 2);
        $siteAllowance = round(max(0, (float)($emp['site_allowance'] ?? 0)), 2);
        $da = round(max(0, (float)($emp['da'] ?? 0)), 2);
        $foodAllowance = round(max(0, (float)($emp['food_allowance'] ?? 0)), 2);
        $travelAllow = round(max(0, (float)($emp['travel_allowance'] ?? 0)), 2);
        $monthlySalary = round($baseSalary + $siteAllowance + $da + $foodAllowance + $travelAllow, 2);
        $totalSalay = $monthlySalary;
        $salaryPerDay = $workingDays > 0 ? round($monthlySalary / $workingDays, 2) : 0.0;
        $overtimeHrs = round(max(0, (float)($manualOvertimeHours[$emp['employee_key']] ?? 0)), 2);
        $overtimeRate = $workingDays > 0
            ? round((($baseSalary + $da) / $workingDays / 8) * 1.5, 2)
            : 0.0;

        $presentDays = round($present, 1);
        $leaveAvailed = (int)$leaves;
        $earnedSalary = round($salaryPerDay * $presentDays, 2);
        $overtimeSalary = round($overtimeRate * $overtimeHrs, 2);
        $attendanceBonusAmount = round(max(0, (float)($emp['attendance_bonus_amount'] ?? 750)), 2);
        $attendBonus = $presentDays >= $workingDays ? $attendanceBonusAmount : 0.0;
        $leaveSalary = round($salaryPerDay * $leaveAvailed, 2);

        $hra = 0.0;
        $allowances = 0.0;
        $totalSalary = round($earnedSalary + $attendBonus + $overtimeSalary, 2);
        // Gross pay: total payable before any statutory/advance deductions.
        $grossPay = $totalSalary;

        // ── Statutory deductions — Indian norms, tenant-configurable rates ──

        // Provident Fund: per-employee opt-out (pf_enabled) wins over the tenant default;
        // wage ceiling caps the PF-eligible wage (EPFO statutory ceiling, default 15000).
        $pfEnabled = $settings['pfEnabled'] && (int)($emp['pf_enabled'] ?? 1) === 1;
        $pfPercent = (float)($emp['pf_percent'] ?? $settings['pfPercent']);
        $pfEligibleWage = min($earnedSalary, $settings['pfWageCeiling'] > 0 ? $settings['pfWageCeiling'] : $earnedSalary);
        $pf = $pfEnabled ? round($pfEligibleWage * ($pfPercent / 100), 2) : 0.0;
        $employerPf = $pfEnabled ? round($pfEligibleWage * ($settings['pfEmployerPercent'] / 100), 2) : 0.0;

        // ESI: applies only when gross is within the ESI wage ceiling (default 21000);
        // per-employee opt-in (esi_enabled) AND tenant default must both allow it.
        $esiApplicable = $settings['esiEnabled']
            && (int)($emp['esi_enabled'] ?? 0) === 1
            && ($settings['esiWageCeiling'] <= 0 || $grossPay <= $settings['esiWageCeiling']);
        $esiPercent = (float)($emp['esi_employee_percent'] ?? $settings['esiPercent']);
        $esi = $esiApplicable ? round($grossPay * ($esiPercent / 100), 2) : 0.0;
        $employerEsi = $esiApplicable ? round($grossPay * ($settings['esiEmployerPercent'] / 100), 2) : 0.0;

        // Professional Tax: slab-based on monthly gross (state PT slabs, configurable).
        $professionalTax = $settings['ptEnabled']
            ? Payroll::professionalTaxFor($grossPay, $settings['ptSlabs'])
            : 0.0;

        // TDS: simplified flat-rate estimate, off by default; only applies above the
        // configured annualised-gross threshold. Not a substitute for Form 16/24Q computation.
        $tds = 0.0;
        if ($settings['tdsEnabled'] && $settings['tdsPercent'] > 0) {
            $annualisedGross = $grossPay * 12;
            if ($annualisedGross > $settings['tdsAnnualThreshold']) {
                $tds = round($grossPay * ($settings['tdsPercent'] / 100), 2);
            }
        }

        $salaryAdvancePaid = round(max(0, (float)($advanceTotals[$emp['employee_key']] ?? 0)), 2);
        $deductedAdvance = $salaryAdvancePaid;
        $deductions = round($pf + $esi + $professionalTax + $tds + $deductedAdvance, 2);
        $netPay = round(max(0, $totalSalary - $deductions), 2);

        return [
            'employeeId'      => $emp['employee_key'],
            'employeeName'    => $emp['name'],
            'designation'     => (string)($emp['designation'] ?? ''),
            'doj'             => (string)($emp['joined_at'] ?? ''),
            'month'           => $month,
            'workingDays'     => $workingDays,
            'presentDays'     => $presentDays,
            'leaves'          => $leaveAvailed,
            'baseSalary'      => $baseSalary,
            'siteAllowance'   => $siteAllowance,
            'da'              => $da,
            'foodAllowance'   => $foodAllowance,
            'totalSalay'      => $totalSalay,
            'salaryPerDay'    => $salaryPerDay,
            'overtimeRate'    => $overtimeRate,
            'overtimeHours'   => $overtimeHrs,
            'overtimeHrs'     => $overtimeHrs,
            'earnedSalary'    => $earnedSalary,
            'overtimeSalary'  => $overtimeSalary,
            'attendBonus'     => $attendBonus,
            'leaveAvailedThisMonth' => $leaveAvailed,
            'leaveSalary'     => $leaveSalary,
            'travelAllow'     => $travelAllow,
            'salaryAdvancePaid' => $salaryAdvancePaid,
            'deductedAdvance' => $deductedAdvance,
            'totalSalary'     => $totalSalary,
            'grossPay'        => $grossPay,
            // Keep legacy fields populated for existing reports/integrations.
            'hra'             => $hra,
            'allowances'      => $allowances,
            'pf'              => $pf,
            'esi'             => $esi,
            'employerPf'      => $employerPf,
            'employerEsi'     => $employerEsi,
            'professionalTax' => $professionalTax,
            'tds'             => $tds,
            'deductions'      => $deductions,
            'netPay'          => $netPay,
            'bankAccountHolder' => $emp['bank_account_holder'] ?? null,
            'bankAccountNumber' => $emp['bank_account_number'] ?? null,
            'bankIfsc'          => $emp['bank_ifsc'] ?? null,
            'bankNameVal'       => $emp['bank_name'] ?? null,
        ];
    }

    /**
     * Working days for the month: prefers the value sent from the admin UI
     * (clamped to 1–31), falls back to calendar count excluding Sundays.
     */
    private function resolveWorkingDays(Request $request, string $month): int
    {
        $override = $request->input('workingDays');
        if ($override !== null && $override !== '') {
            $n = (int)$override;
            if ($n >= 1 && $n <= 31) return $n;
        }

        [$y, $m] = array_map('intval', explode('-', $month));
        $lastDay = (int)date('t', mktime(0, 0, 0, $m, 1, $y));
        $count   = 0;
        for ($d = 1; $d <= $lastDay; $d++) {
            if (date('w', mktime(0, 0, 0, $m, $d, $y)) !== '0') $count++;
        }
        return $count;
    }

    private function resolveOvertimeHours(Request $request): array
    {
        $raw = $request->input('overtimeHours', []);
        if (!is_array($raw)) return [];

        $hours = [];
        foreach ($raw as $employeeKey => $value) {
            $key = trim((string)$employeeKey);
            if ($key === '') continue;
            $hours[$key] = round(max(0, (float)$value), 2);
        }
        return $hours;
    }
}
