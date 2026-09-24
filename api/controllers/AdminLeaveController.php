<?php
declare(strict_types=1);

/**
 * Suggested admin routes are listed in the delivery report. This controller
 * intentionally keeps route registration separate from the module files.
 */
class AdminLeaveController
{
    public function index(Request $request): void
    {
        Response::success(LeaveRequest::all([
            'status' => trim((string)$request->query('status', '')),
            'employee_key' => trim((string)$request->query('employeeId', '')),
            'from' => trim((string)$request->query('from', '')),
            'to' => trim((string)$request->query('to', '')),
        ]));
    }

    public function store(Request $request): void
    {
        $employeeKey = Employee::normalizeEmployeeKey($request->input('employeeId', ''), true);
        if (!Employee::findByKey($employeeKey)) {
            Response::error('Employee not found', 404);
        }

        $leaveTypeId = (int)$request->input('leaveTypeId', 0);
        $leaveType = LeaveType::find($leaveTypeId);
        if (!$leaveType || !(bool)$leaveType['is_active']) {
            Response::error('Leave type not found or inactive', 404);
        }

        $startDate = $this->validDate($request->input('startDate', ''), 'startDate');
        $endDate = $this->validDate($request->input('endDate', ''), 'endDate');
        if ($endDate < $startDate) {
            Response::error('endDate must be on or after startDate', 422);
        }
        if (substr($startDate, 0, 4) !== substr($endDate, 0, 4)) {
            Response::error('A leave request cannot cross calendar years; submit one request per year', 422);
        }
        if (LeaveRequest::hasOverlap($employeeKey, $startDate, $endDate)) {
            Response::error('Employee already has submitted or approved leave in this date range', 409);
        }

        $start = new DateTimeImmutable($startDate);
        $end = new DateTimeImmutable($endDate);
        $days = (float)$start->diff($end)->days + 1.0;
        $reason = trim((string)$request->input('reason', ''));
        $actorId = $this->actorId($request);

        $id = LeaveRequest::create([
            'employee_key' => $employeeKey,
            'leave_type_id' => $leaveTypeId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'requested_days' => $days,
            'balance_year' => (int)substr($startDate, 0, 4),
            'reason' => $reason !== '' ? substr($reason, 0, 1000) : null,
            'submitted_by' => $actorId,
        ]);

        Response::success(LeaveRequest::find($id), 'Leave request submitted', 201);
    }

    public function approve(Request $request): void
    {
        $id = $this->requestId($request);
        Database::beginTransaction();
        try {
            $leaveRequest = LeaveRequest::lock($id);
            if (!$leaveRequest) {
                throw new DomainException('Leave request not found', 404);
            }
            if ($leaveRequest['status'] !== 'submitted') {
                throw new DomainException('Only submitted leave requests can be approved', 409);
            }

            LeaveBalance::deductForApproval($leaveRequest, $this->actorId($request));
            LeaveRequest::approve($id, $this->actorId($request));
            Database::commit();
        } catch (DomainException $e) {
            Database::rollBack();
            Response::error($e->getMessage(), $e->getCode() ?: 409);
        } catch (Throwable $e) {
            Database::rollBack();
            error_log('[Leave] approval failed: ' . $e->getMessage());
            Response::error('Could not approve leave request', 500);
        }

        Response::success(LeaveRequest::find($id), 'Leave request approved');
    }

    public function reject(Request $request): void
    {
        $id = $this->requestId($request);
        $reason = trim((string)$request->input('reason', ''));
        if ($reason === '') {
            Response::error('Rejection reason is required', 422);
        }

        Database::beginTransaction();
        try {
            $leaveRequest = LeaveRequest::lock($id);
            if (!$leaveRequest) {
                throw new DomainException('Leave request not found', 404);
            }
            if ($leaveRequest['status'] !== 'submitted') {
                throw new DomainException('Only submitted leave requests can be rejected', 409);
            }

            LeaveRequest::reject($id, $this->actorId($request), substr($reason, 0, 1000));
            Database::commit();
        } catch (DomainException $e) {
            Database::rollBack();
            Response::error($e->getMessage(), $e->getCode() ?: 409);
        } catch (Throwable $e) {
            Database::rollBack();
            error_log('[Leave] rejection failed: ' . $e->getMessage());
            Response::error('Could not reject leave request', 500);
        }

        Response::success(LeaveRequest::find($id), 'Leave request rejected');
    }

    public function calendar(Request $request): void
    {
        $from = $this->validDate($request->query('from', date('Y-m-01')), 'from');
        $to = $this->validDate($request->query('to', date('Y-m-t')), 'to');
        if ($to < $from) {
            Response::error('to must be on or after from', 422);
        }

        Response::success(LeaveRequest::all(['from' => $from, 'to' => $to]));
    }

    public function register(Request $request): void
    {
        $year = (int)$request->query('year', date('Y'));
        if ($year < 2000 || $year > 2100) {
            Response::error('year must be between 2000 and 2100', 422);
        }
        $from = $this->validDate($request->query('from', sprintf('%04d-01-01', $year)), 'from');
        $to = $this->validDate($request->query('to', sprintf('%04d-12-31', $year)), 'to');
        if ($to < $from || substr($from, 0, 4) !== (string)$year || substr($to, 0, 4) !== (string)$year) {
            Response::error('from and to must be an ordered date range within the selected year', 422);
        }

        $tenantId = Database::tenantId();
        $rows = Database::fetchAll(
            'SELECT e.employee_key, e.name AS employee_name, e.department, e.designation,
                    lt.leave_type_id, lt.name AS leave_type_name, lt.is_paid,
                    COALESCE(lb.opening_balance, lt.annual_quota) AS opening_balance,
                    COALESCE(lb.accrued_days, 0) AS accrued_days,
                    COALESCE(lb.adjusted_days, 0) AS adjusted_days,
                    COALESCE(lb.used_days, 0) AS used_days,
                    COALESCE(req.approved_days, 0) AS approved_days,
                    COALESCE(req.pending_days, 0) AS pending_days,
                    COALESCE(tx.transaction_count, 0) AS transaction_count
               FROM employees e
               CROSS JOIN hr_leave_types lt
          LEFT JOIN hr_leave_balances lb
                 ON lb.tenant_id = e.tenant_id
                AND lb.employee_key = e.employee_key
                AND lb.leave_type_id = lt.leave_type_id
                AND lb.balance_year = ?
          LEFT JOIN (
                SELECT employee_key, leave_type_id,
                       SUM(CASE WHEN status = \'approved\' THEN DATEDIFF(LEAST(end_date, ?), GREATEST(start_date, ?)) + 1 ELSE 0 END) AS approved_days,
                       SUM(CASE WHEN status = \'submitted\' THEN DATEDIFF(LEAST(end_date, ?), GREATEST(start_date, ?)) + 1 ELSE 0 END) AS pending_days
                  FROM hr_leave_requests
                 WHERE tenant_id = ? AND start_date <= ? AND end_date >= ?
                 GROUP BY employee_key, leave_type_id
          ) req ON req.employee_key = e.employee_key AND req.leave_type_id = lt.leave_type_id
          LEFT JOIN (
                SELECT b.employee_key, b.leave_type_id, COUNT(t.transaction_id) AS transaction_count
                  FROM hr_leave_balances b
             LEFT JOIN hr_leave_balance_transactions t
                    ON t.tenant_id = b.tenant_id AND t.balance_id = b.balance_id
                 WHERE b.tenant_id = ? AND b.balance_year = ?
                 GROUP BY b.employee_key, b.leave_type_id
          ) tx ON tx.employee_key = e.employee_key AND tx.leave_type_id = lt.leave_type_id
              WHERE e.tenant_id = ? AND lt.tenant_id = ? AND e.is_active = 1 AND lt.is_active = 1
              ORDER BY e.name, lt.name',
            [$year, $to, $from, $to, $from, $tenantId, $to, $from, $tenantId, $year, $tenantId, $tenantId]
        );

        $requests = Database::fetchAll(
            'SELECT r.leave_request_id, r.employee_key, r.leave_type_id, lt.name AS leave_type_name,
                    lt.is_paid, r.start_date, r.end_date,
                    DATEDIFF(LEAST(r.end_date, ?), GREATEST(r.start_date, ?)) + 1 AS requested_days,
                    r.status, r.reason
               FROM hr_leave_requests r
               JOIN hr_leave_types lt ON lt.leave_type_id = r.leave_type_id AND lt.tenant_id = r.tenant_id
              WHERE r.tenant_id = ? AND r.start_date <= ? AND r.end_date >= ?
              ORDER BY r.start_date DESC, r.leave_request_id DESC',
            [$to, $from, $tenantId, $to, $from]
        );

        $attendance = Database::fetchAll(
            'SELECT r.employee_key,
                    COUNT(DISTINCT CASE WHEN a.status = \'Leave\' THEN a.date END) AS attendance_leave_days,
                    COUNT(DISTINCT CASE WHEN a.status <> \'Leave\' THEN a.date END) AS attendance_conflicts
               FROM hr_leave_requests r
          LEFT JOIN attendance a
                 ON a.tenant_id = r.tenant_id AND a.employee_key = r.employee_key
                AND a.date BETWEEN GREATEST(r.start_date, ?) AND LEAST(r.end_date, ?)
              WHERE r.tenant_id = ? AND r.status = \'approved\'
                AND r.start_date <= ? AND r.end_date >= ?
              GROUP BY r.employee_key',
            [$from, $to, $tenantId, $to, $from]
        );

        $payroll = Database::fetchAll(
            'SELECT employee_key, GROUP_CONCAT(DISTINCT month ORDER BY month) AS payroll_months,
                    SUM(COALESCE(leaves, 0)) AS payroll_leave_days
               FROM payroll
              WHERE tenant_id = ? AND month BETWEEN ? AND ?
              GROUP BY employee_key',
            [$tenantId, substr($from, 0, 7), substr($to, 0, 7)]
        );

        $byEmployee = [];
        foreach ($attendance as $row) $byEmployee[$row['employee_key']]['attendance'] = $row;
        foreach ($payroll as $row) $byEmployee[$row['employee_key']]['payroll'] = $row;
        foreach ($requests as $row) $byEmployee[$row['employee_key']]['requests'][] = $row;

        $employees = [];
        foreach ($rows as $row) {
            $key = (string)$row['employee_key'];
            if (!isset($employees[$key])) {
                $attendanceRow = $byEmployee[$key]['attendance'] ?? [];
                $payrollRow = $byEmployee[$key]['payroll'] ?? [];
                $employees[$key] = [
                    'employee_key' => $key,
                    'employee_name' => $row['employee_name'],
                    'department' => $row['department'],
                    'designation' => $row['designation'],
                    'attendance_leave_days' => (float)($attendanceRow['attendance_leave_days'] ?? 0),
                    'attendance_conflicts' => (int)($attendanceRow['attendance_conflicts'] ?? 0),
                    'payroll_months' => array_values(array_filter(explode(',', (string)($payrollRow['payroll_months'] ?? '')))),
                    'payroll_leave_days' => (float)($payrollRow['payroll_leave_days'] ?? 0),
                    'types' => [],
                    'requests' => $byEmployee[$key]['requests'] ?? [],
                ];
            }
            $opening = (float)$row['opening_balance'];
            $accrued = (float)$row['accrued_days'];
            $adjusted = (float)$row['adjusted_days'];
            $taken = (float)$row['approved_days'];
            $employees[$key]['types'][] = [
                'leave_type_id' => (int)$row['leave_type_id'],
                'leave_type_name' => $row['leave_type_name'],
                'is_paid' => (bool)$row['is_paid'],
                'opening' => $opening,
                'accrued' => $accrued,
                'adjusted' => $adjusted,
                'taken' => $taken,
                'pending' => (float)$row['pending_days'],
                'closing' => $opening + $accrued + $adjusted - (float)$row['used_days'],
                'transaction_count' => (int)$row['transaction_count'],
            ];
        }

        Response::success([
            'year' => $year,
            'from' => $from,
            'to' => $to,
            'employees' => array_values($employees),
        ]);
    }

    public function types(Request $request): void
    {
        Response::success(LeaveType::all($request->query('active') === '1'));
    }

    public function storeType(Request $request): void
    {
        $data = $this->typePayload($request, true);
        $data['created_by'] = $this->actorId($request);

        try {
            $id = LeaveType::create($data);
        } catch (Throwable $e) {
            if ($this->isDuplicate($e)) {
                Response::error('A leave type with this name already exists', 409);
            }
            error_log('[Leave] type create failed: ' . $e->getMessage());
            Response::error('Could not create leave type', 500);
        }

        Response::success(LeaveType::format(LeaveType::find($id) ?? []), 'Leave type created', 201);
    }

    public function updateType(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id < 1 || !LeaveType::find($id)) {
            Response::error('Leave type not found', 404);
        }

        try {
            LeaveType::update($id, $this->typePayload($request, false));
        } catch (Throwable $e) {
            if ($this->isDuplicate($e)) {
                Response::error('A leave type with this name already exists', 409);
            }
            error_log('[Leave] type update failed: ' . $e->getMessage());
            Response::error('Could not update leave type', 500);
        }

        Response::success(LeaveType::format(LeaveType::find($id) ?? []), 'Leave type updated');
    }

    public function balances(Request $request): void
    {
        $year = (int)$request->query('year', date('Y'));
        if ($year < 2000 || $year > 2100) {
            Response::error('year must be between 2000 and 2100', 422);
        }
        $employeeKey = trim((string)$request->query('employeeId', ''));
        if ($employeeKey !== '' && !Employee::findByKey($employeeKey)) {
            Response::error('Employee not found', 404);
        }

        Response::success(LeaveBalance::all($year, $employeeKey ?: null));
    }

    public function accrue(Request $request): void
    {
        $employeeKey = Employee::normalizeEmployeeKey($request->input('employeeId', ''), true);
        if (!Employee::findByKey($employeeKey)) {
            Response::error('Employee not found', 404);
        }

        $leaveTypeId = (int)$request->input('leaveTypeId', 0);
        $year = (int)$request->input('year', date('Y'));
        $days = round((float)$request->input('days', 0), 2);
        if ($leaveTypeId < 1) {
            Response::error('leaveTypeId is required', 422);
        }
        if ($year < 2000 || $year > 2100) {
            Response::error('year must be between 2000 and 2100', 422);
        }
        if ($days <= 0 || $days > 365) {
            Response::error('days must be greater than 0 and at most 365', 422);
        }

        $notes = trim((string)$request->input('notes', ''));
        Database::beginTransaction();
        try {
            $balance = LeaveBalance::accrue(
                $employeeKey,
                $leaveTypeId,
                $year,
                $days,
                $this->actorId($request),
                $notes !== '' ? substr($notes, 0, 500) : null
            );
            Database::commit();
        } catch (DomainException $e) {
            Database::rollBack();
            Response::error($e->getMessage(), $e->getCode() ?: 422);
        } catch (Throwable $e) {
            Database::rollBack();
            error_log('[Leave] accrual failed: ' . $e->getMessage());
            Response::error('Could not accrue leave balance', 500);
        }

        Response::success($balance, 'Leave balance accrued');
    }

    private function typePayload(Request $request, bool $creating): array
    {
        $provided = $request->only(['name', 'annualQuota', 'isPaid', 'isActive']);
        $data = [];

        if ($creating || array_key_exists('name', $provided)) {
            $name = trim((string)($provided['name'] ?? ''));
            if ($name === '') {
                Response::error('Leave type name is required', 422);
            }
            $data['name'] = substr($name, 0, 100);
        }
        if ($creating || array_key_exists('annualQuota', $provided)) {
            $quota = round((float)($provided['annualQuota'] ?? 0), 2);
            if ($quota < 0 || $quota > 365) {
                Response::error('annualQuota must be between 0 and 365', 422);
            }
            $data['annual_quota'] = $quota;
        }
        if ($creating || array_key_exists('isPaid', $provided)) {
            $data['is_paid'] = $this->boolValue($provided['isPaid'] ?? true) ? 1 : 0;
        }
        if (!$creating && array_key_exists('isActive', $provided)) {
            $data['is_active'] = $this->boolValue($provided['isActive']) ? 1 : 0;
        }

        return $data;
    }

    private function validDate(mixed $value, string $field): string
    {
        $date = trim((string)$value);
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        $errors = DateTimeImmutable::getLastErrors();
        if (
            !$parsed
            || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
            || $parsed->format('Y-m-d') !== $date
        ) {
            Response::error("{$field} must be a valid date in YYYY-MM-DD format", 422);
        }
        return $date;
    }

    private function requestId(Request $request): int
    {
        $id = (int)$request->param('id');
        if ($id < 1) {
            Response::error('Invalid leave request ID', 400);
        }
        return $id;
    }

    private function actorId(Request $request): ?int
    {
        return isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;
    }

    private function boolValue(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        return in_array(strtolower(trim((string)$value)), ['1', 'true', 'yes', 'on'], true);
    }

    private function isDuplicate(Throwable $e): bool
    {
        return str_contains($e->getMessage(), 'Duplicate entry')
            || (int)$e->getCode() === 23000;
    }
}
