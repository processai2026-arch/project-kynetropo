<?php
declare(strict_types=1);

/**
 * Payroll model — per-employee payslip rows plus the statutory calculation
 * engine (PF / ESI / Professional Tax / TDS) used by AdminPayrollController.
 * The maker-checker run lifecycle itself lives in PayrollRun.
 */
class Payroll
{
    /** Lifecycle states a payroll row can mirror from its parent run. */
    public const STATUSES = ['draft', 'reviewed', 'approved', 'paid', 'locked'];

    public static function forMonth(string $month): array
    {
        return Database::fetchAll(
            'SELECT p.*, e.name AS employee_name, e.designation, e.joined_at
             FROM payroll p
             JOIN employees e ON p.employee_key = e.employee_key AND e.tenant_id = p.tenant_id
             WHERE p.month = ? AND p.tenant_id = ?
             ORDER BY p.employee_key ASC',
            [$month, Database::tenantId()]
        );
    }

    /** Insert or re-compute (safe to run multiple times for same month). Blocked once locked. */
    public static function upsert(array $data): void
    {
        $existing = Database::fetch(
            'SELECT payroll_id, run_status FROM payroll WHERE tenant_id = ? AND employee_key = ? AND month = ? LIMIT 1',
            [Database::tenantId(), $data['employeeKey'], $data['month']]
        );
        if ($existing && ($existing['run_status'] ?? 'draft') === 'locked') {
            throw new RuntimeException("Payroll for {$data['month']} is locked and cannot be recomputed.");
        }

        Database::execute(
            'INSERT INTO payroll
               (tenant_id, employee_key, month, working_days, present_days, salary_per_day,
                leaves, leave_availed_this_month, leave_salary, travel_allow,
                total_salary, salary_advance_paid, deducted_advance,
                base_salary, site_allowance, da, food_allowance, total_salay,
                earned_salary, attend_bonus,
                overtime_rate, overtime_hrs, overtime_salary,
                hra, allowances, gross_pay,
                pf, esi, employer_pf, employer_esi, professional_tax, tds, deductions, net_pay,
                bank_account_holder, bank_account_number, bank_ifsc, bank_name,
                run_status, status, generated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     ?, ?, ?, ?, ?, ?, ?, ?,
                     ?, ?, ?, ?,
                     ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
               working_days=VALUES(working_days),   present_days=VALUES(present_days),
               salary_per_day=VALUES(salary_per_day),
               leaves=VALUES(leaves),
               leave_availed_this_month=VALUES(leave_availed_this_month),
               leave_salary=VALUES(leave_salary),   travel_allow=VALUES(travel_allow),
               salary_advance_paid=VALUES(salary_advance_paid),
               deducted_advance=VALUES(deducted_advance),
               base_salary=VALUES(base_salary),     site_allowance=VALUES(site_allowance),
               da=VALUES(da),                       food_allowance=VALUES(food_allowance),
               total_salay=VALUES(total_salay),
               earned_salary=VALUES(earned_salary), attend_bonus=VALUES(attend_bonus),
               total_salary=VALUES(total_salary),
               overtime_rate=VALUES(overtime_rate), overtime_hrs=VALUES(overtime_hrs),
               overtime_salary=VALUES(overtime_salary),
               hra=VALUES(hra),                     allowances=VALUES(allowances),
               gross_pay=VALUES(gross_pay),
               pf=VALUES(pf),                       esi=VALUES(esi),
               employer_pf=VALUES(employer_pf),     employer_esi=VALUES(employer_esi),
               professional_tax=VALUES(professional_tax),
               tds=VALUES(tds),
               deductions=VALUES(deductions),       net_pay=VALUES(net_pay),
               bank_account_holder=VALUES(bank_account_holder),
               bank_account_number=VALUES(bank_account_number),
               bank_ifsc=VALUES(bank_ifsc),         bank_name=VALUES(bank_name),
               run_status=VALUES(run_status),       status=VALUES(status),
               generated_at=NOW()',
            [
                Database::tenantId(),
                $data['employeeKey'],   $data['month'],      $data['workingDays'],
                $data['presentDays'],   $data['salaryPerDay'],
                $data['leaves'],        $data['leaveAvailedThisMonth'],
                $data['leaveSalary'],   $data['travelAllow'],
                $data['totalSalary'],   $data['salaryAdvancePaid'],
                $data['deductedAdvance'],
                $data['baseSalary'],    $data['siteAllowance'],
                $data['da'],            $data['foodAllowance'],
                $data['totalSalay'],    $data['earnedSalary'],
                $data['attendBonus'],
                $data['overtimeRate'],  $data['overtimeHours'],
                $data['overtimeSalary'],
                $data['hra'],           $data['allowances'],
                $data['grossPay'],
                $data['pf'],            $data['esi'],
                $data['employerPf'],    $data['employerEsi'],
                $data['professionalTax'], $data['tds'],
                $data['deductions'],    $data['netPay'],
                $data['bankAccountHolder'] ?? null,
                $data['bankAccountNumber'] ?? null,
                $data['bankIfsc'] ?? null,
                $data['bankName'] ?? null,
                'draft', 'Draft',
            ]
        );
    }

    /** Stamp every row for a month with the run's id + lifecycle status. */
    public static function syncRunStatus(string $month, int $runId, string $runStatus): int
    {
        $statusColumn = self::legacyStatusFor($runStatus);
        $locked = $runStatus === 'locked' ? 1 : 0;

        $cols = ["run_id = ?", "run_status = ?", "status = ?", "locked = ?"];
        $params = [$runId, $runStatus, $statusColumn, $locked];

        if ($runStatus === 'approved' || $runStatus === 'paid' || $runStatus === 'locked') {
            $cols[] = 'processed_at = COALESCE(processed_at, NOW())';
        }
        if ($runStatus === 'paid' || $runStatus === 'locked') {
            $cols[] = 'paid_at = COALESCE(paid_at, NOW())';
        }

        $sql = 'UPDATE payroll SET ' . implode(', ', $cols) . ' WHERE month = ? AND tenant_id = ?';
        $params[] = $month;
        $params[] = Database::tenantId();

        return Database::execute($sql, $params);
    }

    private static function legacyStatusFor(string $runStatus): string
    {
        return match ($runStatus) {
            'paid', 'locked' => 'Paid',
            'approved', 'reviewed' => 'Processed',
            default => 'Draft',
        };
    }

    public static function format(array $row): array
    {
        return [
            'employeeId'      => $row['employee_key'],
            'employeeName'    => $row['employee_name'],
            'designation'     => $row['designation'],
            'doj'             => $row['joined_at'] ?? '',
            'month'           => $row['month'],
            'workingDays'     => (int)$row['working_days'],
            'presentDays'     => (float)$row['present_days'],
            'leaves'          => (int)$row['leaves'],
            'leaveAvailedThisMonth' => (int)($row['leave_availed_this_month'] ?? $row['leaves'] ?? 0),
            'leaveSalary'     => (float)($row['leave_salary'] ?? 0),
            'travelAllow'     => (float)($row['travel_allow'] ?? 0),
            'salaryAdvancePaid' => (float)($row['salary_advance_paid'] ?? 0),
            'deductedAdvance' => (float)($row['deducted_advance'] ?? 0),
            'baseSalary'      => (float)$row['base_salary'],
            'siteAllowance'   => (float)($row['site_allowance'] ?? 0),
            'da'              => (float)($row['da'] ?? 0),
            'foodAllowance'   => (float)($row['food_allowance'] ?? 0),
            'totalSalay'      => (float)($row['total_salay'] ?? $row['base_salary'] ?? 0),
            'salaryPerDay'    => (float)($row['salary_per_day'] ?? 0),
            'earnedSalary'    => (float)$row['earned_salary'],
            'attendBonus'     => (float)($row['attend_bonus'] ?? 0),
            'overtimeRate'    => (float)($row['overtime_rate'] ?? 0),
            'overtimeHours'   => (float)($row['overtime_hrs'] ?? $row['overtime_hours'] ?? 0),
            'overtimeSalary'  => (float)($row['overtime_salary'] ?? 0),
            'totalSalary'     => (float)($row['total_salary'] ?? 0),
            'hra'             => (float)$row['hra'],
            'allowances'      => (float)$row['allowances'],
            'grossPay'        => (float)($row['gross_pay'] ?? $row['total_salary'] ?? 0),
            'pf'              => (float)$row['pf'],
            'esi'             => (float)($row['esi'] ?? 0),
            'employerPf'      => (float)($row['employer_pf'] ?? 0),
            'employerEsi'     => (float)($row['employer_esi'] ?? 0),
            'professionalTax' => (float)$row['professional_tax'],
            'tds'             => (float)($row['tds'] ?? 0),
            'deductions'      => (float)$row['deductions'],
            'netPay'          => (float)$row['net_pay'],
            'status'          => $row['status'] ?? 'Draft',
            'runStatus'       => $row['run_status'] ?? 'draft',
            'locked'          => (bool)($row['locked'] ?? false),
            'bankAccountHolder' => $row['bank_account_holder'] ?? null,
            'bankAccountNumber' => $row['bank_account_number'] ?? null,
            'bankIfsc'          => $row['bank_ifsc'] ?? null,
            'bankName'          => $row['bank_name'] ?? null,
            'processedAt'     => isset($row['processed_at']) && $row['processed_at'] ? date('c', strtotime($row['processed_at'])) : null,
            'paidAt'          => isset($row['paid_at'])      && $row['paid_at']      ? date('c', strtotime($row['paid_at']))      : null,
        ];
    }

    // ─── Statutory settings (PF / ESI / PT / TDS) — stored as tenant settings ──

    private const SETTING_DEFAULTS = [
        'payroll_pf_enabled'           => '1',
        'payroll_pf_percent'           => '12',       // employee contribution
        'payroll_pf_employer_percent'  => '12',       // employer contribution (informational)
        'payroll_pf_wage_ceiling'      => '15000',    // EPFO statutory wage ceiling
        'payroll_esi_enabled'          => '1',
        'payroll_esi_percent'          => '0.75',     // employee contribution
        'payroll_esi_employer_percent' => '3.25',     // employer contribution (informational)
        'payroll_esi_wage_ceiling'     => '21000',    // ESI applicability ceiling (gross/month)
        'payroll_pt_enabled'           => '1',
        // Tamil Nadu-style half-yearly-equivalent monthly PT slabs (gross monthly salary -> tax)
        // configurable JSON: [{"upTo":21000,"tax":0}, ...] — last slab upTo=null means "and above"
        'payroll_pt_slabs'             => '[{"upTo":21000,"tax":0},{"upTo":30000,"tax":135},{"upTo":45000,"tax":315},{"upTo":60000,"tax":690},{"upTo":75000,"tax":1025},{"upTo":null,"tax":1250}]',
        'payroll_tds_enabled'          => '0',
        'payroll_tds_percent'          => '0',        // flat simplified TDS rate; 0 = off by default
        'payroll_tds_annual_threshold' => '250000',   // below this annual gross, no TDS even if enabled
    ];

    public static function getSettings(): array
    {
        $rows = Database::fetchAll(
            'SELECT setting_key, setting_value FROM settings WHERE tenant_id = ? AND setting_key LIKE \'payroll_%\'',
            [Database::tenantId()]
        );
        $map = [];
        foreach ($rows as $r) $map[$r['setting_key']] = $r['setting_value'];

        $resolved = [];
        foreach (self::SETTING_DEFAULTS as $key => $default) {
            $resolved[$key] = $map[$key] ?? $default;
        }

        $slabs = json_decode((string)$resolved['payroll_pt_slabs'], true);
        if (!is_array($slabs)) $slabs = json_decode(self::SETTING_DEFAULTS['payroll_pt_slabs'], true);

        return [
            'pfEnabled'          => (bool)(int)$resolved['payroll_pf_enabled'],
            'pfPercent'          => (float)$resolved['payroll_pf_percent'],
            'pfEmployerPercent'  => (float)$resolved['payroll_pf_employer_percent'],
            'pfWageCeiling'      => (float)$resolved['payroll_pf_wage_ceiling'],
            'esiEnabled'         => (bool)(int)$resolved['payroll_esi_enabled'],
            'esiPercent'         => (float)$resolved['payroll_esi_percent'],
            'esiEmployerPercent' => (float)$resolved['payroll_esi_employer_percent'],
            'esiWageCeiling'     => (float)$resolved['payroll_esi_wage_ceiling'],
            'ptEnabled'          => (bool)(int)$resolved['payroll_pt_enabled'],
            'ptSlabs'            => $slabs,
            'tdsEnabled'         => (bool)(int)$resolved['payroll_tds_enabled'],
            'tdsPercent'         => (float)$resolved['payroll_tds_percent'],
            'tdsAnnualThreshold' => (float)$resolved['payroll_tds_annual_threshold'],
        ];
    }

    public static function updateSettings(array $input): array
    {
        $map = [
            'pfEnabled'          => ['payroll_pf_enabled', 'bool'],
            'pfPercent'          => ['payroll_pf_percent', 'float'],
            'pfEmployerPercent'  => ['payroll_pf_employer_percent', 'float'],
            'pfWageCeiling'      => ['payroll_pf_wage_ceiling', 'float'],
            'esiEnabled'         => ['payroll_esi_enabled', 'bool'],
            'esiPercent'         => ['payroll_esi_percent', 'float'],
            'esiEmployerPercent' => ['payroll_esi_employer_percent', 'float'],
            'esiWageCeiling'     => ['payroll_esi_wage_ceiling', 'float'],
            'ptEnabled'          => ['payroll_pt_enabled', 'bool'],
            'tdsEnabled'         => ['payroll_tds_enabled', 'bool'],
            'tdsPercent'         => ['payroll_tds_percent', 'float'],
            'tdsAnnualThreshold' => ['payroll_tds_annual_threshold', 'float'],
        ];

        foreach ($map as $inputKey => [$settingKey, $type]) {
            if (!array_key_exists($inputKey, $input)) continue;
            $value = $input[$inputKey];
            $stored = $type === 'bool' ? ((bool)$value ? '1' : '0') : (string)(float)$value;
            self::upsertSetting($settingKey, $stored);
        }

        if (array_key_exists('ptSlabs', $input) && is_array($input['ptSlabs'])) {
            $clean = [];
            foreach ($input['ptSlabs'] as $slab) {
                if (!is_array($slab) || !array_key_exists('tax', $slab)) continue;
                $clean[] = [
                    'upTo' => isset($slab['upTo']) && $slab['upTo'] !== null ? (float)$slab['upTo'] : null,
                    'tax'  => (float)$slab['tax'],
                ];
            }
            if (!empty($clean)) self::upsertSetting('payroll_pt_slabs', json_encode($clean));
        }

        return self::getSettings();
    }

    private static function upsertSetting(string $key, string $value): void
    {
        Database::execute(
            'INSERT INTO settings (tenant_id, setting_key, setting_value)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
            [Database::tenantId(), $key, $value]
        );
    }

    /** Professional tax for a given monthly gross, per the configured slabs. */
    public static function professionalTaxFor(float $monthlyGross, array $slabs): float
    {
        foreach ($slabs as $slab) {
            $upTo = $slab['upTo'] ?? null;
            if ($upTo === null || $monthlyGross <= (float)$upTo) {
                return round((float)($slab['tax'] ?? 0), 2);
            }
        }
        return 0.0;
    }
}
