<?php
declare(strict_types=1);

class LeaveType
{
    public static function all(bool $activeOnly = false): array
    {
        $sql = 'SELECT * FROM hr_leave_types WHERE tenant_id = ?';
        $params = [Database::tenantId()];
        if ($activeOnly) {
            $sql .= ' AND is_active = 1';
        }

        $rows = Database::fetchAll($sql . ' ORDER BY is_active DESC, name ASC', $params);
        return array_map([self::class, 'format'], $rows);
    }

    public static function find(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM hr_leave_types WHERE leave_type_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function create(array $data): int
    {
        return Database::insertTenant('hr_leave_types', [
            'name' => $data['name'],
            'annual_quota' => $data['annual_quota'],
            'is_paid' => $data['is_paid'],
            'is_active' => 1,
            'created_by' => $data['created_by'],
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public static function update(int $id, array $data): void
    {
        $fields = [];
        $params = [];
        foreach ([
            'name' => 'name',
            'annual_quota' => 'annual_quota',
            'is_paid' => 'is_paid',
            'is_active' => 'is_active',
        ] as $key => $column) {
            if (!array_key_exists($key, $data)) {
                continue;
            }
            $fields[] = "{$column} = ?";
            $params[] = $data[$key];
        }

        if (!$fields) {
            return;
        }

        $params[] = $id;
        $params[] = Database::tenantId();
        Database::execute(
            'UPDATE hr_leave_types SET ' . implode(', ', $fields) . ', updated_at = NOW()
             WHERE leave_type_id = ? AND tenant_id = ?',
            $params
        );
    }

    public static function format(array $row): array
    {
        return [
            'leave_type_id' => (int)$row['leave_type_id'],
            'name' => (string)$row['name'],
            'annual_quota' => (float)$row['annual_quota'],
            'is_paid' => (bool)$row['is_paid'],
            'is_active' => (bool)$row['is_active'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }
}
