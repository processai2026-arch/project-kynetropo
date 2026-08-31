<?php
declare(strict_types=1);

class Account
{
    public const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'];

    public static function all(bool $includeInactive = true): array
    {
        $sql = 'SELECT * FROM accounts WHERE tenant_id = ?';
        $params = [Database::tenantId()];
        if (!$includeInactive) {
            $sql .= ' AND is_active = 1';
        }
        $sql .= ' ORDER BY FIELD(type, "asset", "liability", "equity", "income", "expense"), code ASC, name ASC';

        return array_map([self::class, 'format'], Database::fetchAll($sql, $params));
    }

    public static function find(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT * FROM accounts WHERE account_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );

        return $row ? self::format($row) : null;
    }

    public static function codeExists(string $code, ?int $excludeId = null): bool
    {
        $sql = 'SELECT account_id FROM accounts WHERE tenant_id = ? AND code = ?';
        $params = [Database::tenantId(), $code];
        if ($excludeId !== null) {
            $sql .= ' AND account_id != ?';
            $params[] = $excludeId;
        }

        return Database::fetch($sql . ' LIMIT 1', $params) !== null;
    }

    public static function create(array $data): int
    {
        return Database::insertTenant('accounts', [
            'code' => $data['code'],
            'name' => $data['name'],
            'type' => $data['type'],
            'description' => $data['description'] ?: null,
            'is_active' => $data['is_active'] ? 1 : 0,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public static function update(int $id, array $data): void
    {
        $fields = [];
        $params = [];
        foreach (['code', 'name', 'type', 'description', 'is_active'] as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $fields[] = "`{$field}` = ?";
            if ($field === 'is_active') {
                $params[] = $data[$field] ? 1 : 0;
            } elseif ($field === 'description') {
                $params[] = $data[$field] ?: null;
            } else {
                $params[] = $data[$field];
            }
        }
        if (!$fields) {
            return;
        }

        $params[] = $id;
        $params[] = Database::tenantId();
        Database::execute(
            'UPDATE accounts SET ' . implode(', ', $fields) . ', updated_at = NOW()
             WHERE account_id = ? AND tenant_id = ?',
            $params
        );
    }

    public static function delete(int $id): void
    {
        Database::execute(
            'DELETE FROM accounts WHERE account_id = ? AND tenant_id = ?',
            [$id, Database::tenantId()]
        );
    }

    public static function hasJournalLines(int $id): bool
    {
        return Database::fetch(
            'SELECT journal_line_id FROM journal_lines WHERE account_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        ) !== null;
    }

    public static function format(array $row): array
    {
        return [
            'account_id' => (int)$row['account_id'],
            'code' => (string)$row['code'],
            'name' => (string)$row['name'],
            'type' => (string)$row['type'],
            'description' => $row['description'] ?? null,
            'is_active' => (bool)$row['is_active'],
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }
}
