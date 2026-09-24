<?php
declare(strict_types=1);

class EmployeeAdvance
{
    public static function all(array $filters = []): array
    {
        $where = ['a.tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['month'])) {
            $where[] = 'a.payroll_month = ?';
            $params[] = $filters['month'];
        }
        if (!empty($filters['employeeKey'])) {
            $where[] = 'a.employee_key = ?';
            $params[] = $filters['employeeKey'];
        }

        return Database::fetchAll(
            'SELECT a.*, e.name AS employee_name, e.designation
               FROM employee_advances a
               JOIN employees e ON a.employee_key = e.employee_key AND e.tenant_id = a.tenant_id
              WHERE ' . implode(' AND ', $where) . '
              ORDER BY a.advance_date DESC, a.advance_id DESC',
            $params
        );
    }

    public static function find(int $id): ?array
    {
        return Database::fetch(
            'SELECT a.*, e.name AS employee_name, e.designation
               FROM employee_advances a
               JOIN employees e ON a.employee_key = e.employee_key AND e.tenant_id = a.tenant_id
              WHERE a.advance_id = ? AND a.tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function create(array $data): int
    {
        return Database::insertTenant('employee_advances', [
            'employee_key'  => $data['employeeKey'],
            'advance_date'  => $data['advanceDate'],
            'payroll_month' => $data['payrollMonth'],
            'amount'        => $data['amount'],
            'notes'         => $data['notes'],
            'created_at'    => date('Y-m-d H:i:s'),
            'updated_at'    => date('Y-m-d H:i:s'),
        ]);
    }

    public static function update(int $id, array $data): void
    {
        Database::execute(
            'UPDATE employee_advances
                SET employee_key = ?, advance_date = ?, payroll_month = ?, amount = ?, notes = ?, updated_at = NOW()
              WHERE advance_id = ? AND tenant_id = ?',
            [
                $data['employeeKey'],
                $data['advanceDate'],
                $data['payrollMonth'],
                $data['amount'],
                $data['notes'],
                $id,
                Database::tenantId(),
            ]
        );
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM employee_advances WHERE advance_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
    }

    public static function totalsForMonth(string $month): array
    {
        $rows = Database::fetchAll(
            'SELECT employee_key, SUM(amount) AS total_advance
               FROM employee_advances
              WHERE payroll_month = ? AND tenant_id = ?
              GROUP BY employee_key',
            [$month, Database::tenantId()]
        );

        $totals = [];
        foreach ($rows as $row) {
            $totals[(string)$row['employee_key']] = round(max(0, (float)$row['total_advance']), 2);
        }
        return $totals;
    }

    public static function format(array $row): array
    {
        return [
            'id'           => (int)$row['advance_id'],
            'employeeId'   => $row['employee_key'],
            'employeeName' => $row['employee_name'] ?? '',
            'designation'  => $row['designation'] ?? '',
            'advanceDate'  => $row['advance_date'],
            'payrollMonth' => $row['payroll_month'],
            'amount'       => (float)$row['amount'],
            'notes'        => $row['notes'] ?? '',
            'createdAt'    => isset($row['created_at']) && $row['created_at'] ? date('c', strtotime($row['created_at'])) : null,
            'updatedAt'    => isset($row['updated_at']) && $row['updated_at'] ? date('c', strtotime($row['updated_at'])) : null,
        ];
    }
}
