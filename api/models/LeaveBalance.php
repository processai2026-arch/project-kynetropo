<?php
declare(strict_types=1);

class LeaveBalance
{
    public static function all(int $year, ?string $employeeKey = null): array
    {
        $where = ['e.tenant_id = ?', 'lt.tenant_id = ?', 'e.is_active = 1'];
        $params = [Database::tenantId(), Database::tenantId()];
        if ($employeeKey !== null && $employeeKey !== '') {
            $where[] = 'e.employee_key = ?';
            $params[] = $employeeKey;
        }

        $rows = Database::fetchAll(
            'SELECT lb.balance_id, e.employee_key, e.name AS employee_name, e.department,
                    lt.leave_type_id, lt.name AS leave_type_name, lt.annual_quota, lt.is_paid,
                    ? AS balance_year,
                    COALESCE(lb.opening_balance, lt.annual_quota) AS opening_balance,
                    COALESCE(lb.accrued_days, 0) AS accrued_days,
                    COALESCE(lb.adjusted_days, 0) AS adjusted_days,
                    COALESCE(lb.used_days, 0) AS used_days,
                    lb.last_accrual_at
             FROM employees e
             CROSS JOIN hr_leave_types lt
             LEFT JOIN hr_leave_balances lb
               ON lb.tenant_id = e.tenant_id
              AND lb.employee_key = e.employee_key
              AND lb.leave_type_id = lt.leave_type_id
              AND lb.balance_year = ?
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY e.name ASC, lt.name ASC',
            [$year, $year, ...$params]
        );

        return array_map([self::class, 'format'], $rows);
    }

    public static function accrue(
        string $employeeKey,
        int $leaveTypeId,
        int $year,
        float $days,
        ?int $actorId,
        ?string $notes
    ): array {
        $type = LeaveType::find($leaveTypeId);
        if (!$type || !(bool)$type['is_active']) {
            throw new DomainException('Leave type not found or inactive', 404);
        }

        $balance = self::lockOrCreate($employeeKey, $leaveTypeId, $year, (float)$type['annual_quota'], $actorId);
        Database::execute(
            'UPDATE hr_leave_balances
             SET accrued_days = accrued_days + ?, last_accrual_at = NOW(), updated_at = NOW()
             WHERE balance_id = ? AND tenant_id = ?',
            [$days, (int)$balance['balance_id'], Database::tenantId()]
        );
        self::recordTransaction(
            (int)$balance['balance_id'],
            null,
            'accrual',
            $days,
            $notes ?: "Accrual for {$year}",
            $actorId
        );

        return self::find((int)$balance['balance_id']) ?? [];
    }

    public static function deductForApproval(array $request, ?int $actorId): array
    {
        $type = LeaveType::find((int)$request['leave_type_id']);
        if (!$type) {
            throw new DomainException('Leave type not found', 404);
        }

        $balance = self::lockOrCreate(
            (string)$request['employee_key'],
            (int)$request['leave_type_id'],
            (int)$request['balance_year'],
            (float)$type['annual_quota'],
            $actorId
        );
        $available = self::available($balance);
        $days = (float)$request['requested_days'];
        if ($available + 0.00001 < $days) {
            throw new DomainException(
                sprintf('Insufficient leave balance: %.2f day(s) available', $available),
                409
            );
        }

        Database::execute(
            'UPDATE hr_leave_balances SET used_days = used_days + ?, updated_at = NOW()
             WHERE balance_id = ? AND tenant_id = ?',
            [$days, (int)$balance['balance_id'], Database::tenantId()]
        );
        self::recordTransaction(
            (int)$balance['balance_id'],
            (int)$request['leave_request_id'],
            'approval',
            -$days,
            sprintf('Approved leave %s to %s', $request['start_date'], $request['end_date']),
            $actorId
        );

        return self::find((int)$balance['balance_id']) ?? [];
    }

    public static function find(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT lb.*, e.name AS employee_name, e.department,
                    lt.name AS leave_type_name, lt.annual_quota, lt.is_paid
             FROM hr_leave_balances lb
             JOIN employees e
               ON e.employee_key = lb.employee_key AND e.tenant_id = lb.tenant_id
             JOIN hr_leave_types lt
               ON lt.leave_type_id = lb.leave_type_id AND lt.tenant_id = lb.tenant_id
             WHERE lb.balance_id = ? AND lb.tenant_id = ?
             LIMIT 1',
            [$id, Database::tenantId()]
        );

        return $row ? self::format($row) : null;
    }

    private static function lockOrCreate(
        string $employeeKey,
        int $leaveTypeId,
        int $year,
        float $openingBalance,
        ?int $actorId
    ): array {
        $row = Database::fetch(
            'SELECT * FROM hr_leave_balances
             WHERE employee_key = ? AND leave_type_id = ? AND balance_year = ? AND tenant_id = ?
             FOR UPDATE',
            [$employeeKey, $leaveTypeId, $year, Database::tenantId()]
        );
        if ($row) {
            return $row;
        }

        $inserted = Database::execute(
            'INSERT IGNORE INTO hr_leave_balances
                (tenant_id, employee_key, leave_type_id, balance_year, opening_balance, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())',
            [Database::tenantId(), $employeeKey, $leaveTypeId, $year, $openingBalance]
        );
        $row = Database::fetch(
            'SELECT * FROM hr_leave_balances
             WHERE employee_key = ? AND leave_type_id = ? AND balance_year = ? AND tenant_id = ?
             FOR UPDATE',
            [$employeeKey, $leaveTypeId, $year, Database::tenantId()]
        );
        if (!$row) {
            throw new RuntimeException('Could not initialize leave balance');
        }

        if ($inserted > 0) {
            self::recordTransaction(
                (int)$row['balance_id'],
                null,
                'opening',
                $openingBalance,
                "Annual quota allocation for {$year}",
                $actorId
            );
        }
        return $row;
    }

    private static function recordTransaction(
        int $balanceId,
        ?int $requestId,
        string $type,
        float $days,
        ?string $notes,
        ?int $actorId
    ): void {
        Database::insertTenant('hr_leave_balance_transactions', [
            'balance_id' => $balanceId,
            'leave_request_id' => $requestId,
            'transaction_type' => $type,
            'days' => $days,
            'notes' => $notes,
            'created_by' => $actorId,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    private static function available(array $row): float
    {
        return round(
            (float)$row['opening_balance']
            + (float)$row['accrued_days']
            + (float)$row['adjusted_days']
            - (float)$row['used_days'],
            2
        );
    }

    public static function format(array $row): array
    {
        $available = self::available($row);
        return [
            'balance_id' => isset($row['balance_id']) ? (int)$row['balance_id'] : null,
            'employee_key' => (string)$row['employee_key'],
            'employee_name' => (string)$row['employee_name'],
            'department' => $row['department'] ?? null,
            'leave_type_id' => (int)$row['leave_type_id'],
            'leave_type_name' => (string)$row['leave_type_name'],
            'annual_quota' => (float)$row['annual_quota'],
            'is_paid' => (bool)$row['is_paid'],
            'balance_year' => (int)$row['balance_year'],
            'opening_balance' => (float)$row['opening_balance'],
            'accrued_days' => (float)$row['accrued_days'],
            'adjusted_days' => (float)$row['adjusted_days'],
            'used_days' => (float)$row['used_days'],
            'available_days' => $available,
            'last_accrual_at' => $row['last_accrual_at'] ?? null,
        ];
    }
}
