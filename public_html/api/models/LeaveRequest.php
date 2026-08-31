<?php
declare(strict_types=1);

class LeaveRequest
{
    public const STATUSES = ['submitted', 'approved', 'rejected'];

    public static function all(array $filters = []): array
    {
        $where = ['lr.tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['status']) && in_array($filters['status'], self::STATUSES, true)) {
            $where[] = 'lr.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['employee_key'])) {
            $where[] = 'lr.employee_key = ?';
            $params[] = $filters['employee_key'];
        }
        if (!empty($filters['from'])) {
            $where[] = 'lr.end_date >= ?';
            $params[] = $filters['from'];
        }
        if (!empty($filters['to'])) {
            $where[] = 'lr.start_date <= ?';
            $params[] = $filters['to'];
        }

        $rows = Database::fetchAll(
            'SELECT lr.*, e.name AS employee_name, e.department,
                    lt.name AS leave_type_name, lt.is_paid
             FROM hr_leave_requests lr
             JOIN employees e
               ON e.employee_key = lr.employee_key AND e.tenant_id = lr.tenant_id
             JOIN hr_leave_types lt
               ON lt.leave_type_id = lr.leave_type_id AND lt.tenant_id = lr.tenant_id
             WHERE ' . implode(' AND ', $where) . '
             ORDER BY
               CASE lr.status WHEN "submitted" THEN 0 WHEN "approved" THEN 1 ELSE 2 END,
               lr.start_date DESC, lr.leave_request_id DESC',
            $params
        );

        return array_map([self::class, 'format'], $rows);
    }

    public static function find(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT lr.*, e.name AS employee_name, e.department,
                    lt.name AS leave_type_name, lt.is_paid
             FROM hr_leave_requests lr
             JOIN employees e
               ON e.employee_key = lr.employee_key AND e.tenant_id = lr.tenant_id
             JOIN hr_leave_types lt
               ON lt.leave_type_id = lr.leave_type_id AND lt.tenant_id = lr.tenant_id
             WHERE lr.leave_request_id = ? AND lr.tenant_id = ?
             LIMIT 1',
            [$id, Database::tenantId()]
        );

        return $row ? self::format($row) : null;
    }

    public static function lock(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM hr_leave_requests
             WHERE leave_request_id = ? AND tenant_id = ?
             FOR UPDATE',
            [$id, Database::tenantId()]
        );
    }

    public static function create(array $data): int
    {
        return Database::insertTenant('hr_leave_requests', [
            'employee_key' => $data['employee_key'],
            'leave_type_id' => $data['leave_type_id'],
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'requested_days' => $data['requested_days'],
            'balance_year' => $data['balance_year'],
            'reason' => $data['reason'],
            'status' => 'submitted',
            'submitted_by' => $data['submitted_by'],
            'submitted_at' => date('Y-m-d H:i:s'),
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public static function hasOverlap(string $employeeKey, string $startDate, string $endDate): bool
    {
        return Database::fetch(
            'SELECT leave_request_id
             FROM hr_leave_requests
             WHERE employee_key = ? AND tenant_id = ?
               AND status IN ("submitted", "approved")
               AND start_date <= ? AND end_date >= ?
             LIMIT 1',
            [$employeeKey, Database::tenantId(), $endDate, $startDate]
        ) !== null;
    }

    public static function approve(int $id, ?int $actorId): void
    {
        Database::execute(
            'UPDATE hr_leave_requests
             SET status = "approved", approved_by = ?, approved_at = NOW(),
                 rejected_by = NULL, rejected_at = NULL, rejection_reason = NULL, updated_at = NOW()
             WHERE leave_request_id = ? AND tenant_id = ?',
            [$actorId, $id, Database::tenantId()]
        );
    }

    public static function reject(int $id, ?int $actorId, string $reason): void
    {
        Database::execute(
            'UPDATE hr_leave_requests
             SET status = "rejected", rejected_by = ?, rejected_at = NOW(),
                 rejection_reason = ?, approved_by = NULL, approved_at = NULL, updated_at = NOW()
             WHERE leave_request_id = ? AND tenant_id = ?',
            [$actorId, $reason, $id, Database::tenantId()]
        );
    }

    public static function format(array $row): array
    {
        return [
            'leave_request_id' => (int)$row['leave_request_id'],
            'employee_key' => (string)$row['employee_key'],
            'employee_name' => $row['employee_name'] ?? null,
            'department' => $row['department'] ?? null,
            'leave_type_id' => (int)$row['leave_type_id'],
            'leave_type_name' => $row['leave_type_name'] ?? null,
            'is_paid' => isset($row['is_paid']) ? (bool)$row['is_paid'] : null,
            'start_date' => (string)$row['start_date'],
            'end_date' => (string)$row['end_date'],
            'requested_days' => (float)$row['requested_days'],
            'balance_year' => (int)$row['balance_year'],
            'reason' => $row['reason'],
            'status' => (string)$row['status'],
            'submitted_by' => $row['submitted_by'] ? (int)$row['submitted_by'] : null,
            'submitted_at' => $row['submitted_at'],
            'approved_by' => $row['approved_by'] ? (int)$row['approved_by'] : null,
            'approved_at' => $row['approved_at'],
            'rejected_by' => $row['rejected_by'] ? (int)$row['rejected_by'] : null,
            'rejected_at' => $row['rejected_at'],
            'rejection_reason' => $row['rejection_reason'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }
}
