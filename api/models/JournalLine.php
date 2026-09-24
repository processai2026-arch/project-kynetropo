<?php
declare(strict_types=1);

class JournalLine
{
    public static function forEntry(int $entryId): array
    {
        $rows = Database::fetchAll(
            'SELECT jl.*, a.code AS account_code, a.name AS account_name, a.type AS account_type
             FROM journal_lines jl
             JOIN accounts a ON a.account_id = jl.account_id AND a.tenant_id = jl.tenant_id
             WHERE jl.journal_entry_id = ? AND jl.tenant_id = ?
             ORDER BY jl.sort_order ASC, jl.journal_line_id ASC',
            [$entryId, Database::tenantId()]
        );

        return array_map([self::class, 'format'], $rows);
    }

    public static function create(int $entryId, array $data, int $sortOrder): int
    {
        return Database::insertTenant('journal_lines', [
            'journal_entry_id' => $entryId,
            'account_id' => $data['account_id'],
            'description' => $data['description'] ?: null,
            'debit' => $data['debit'],
            'credit' => $data['credit'],
            'sort_order' => $sortOrder,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public static function format(array $row): array
    {
        return [
            'journal_line_id' => (int)$row['journal_line_id'],
            'journal_entry_id' => (int)$row['journal_entry_id'],
            'account_id' => (int)$row['account_id'],
            'account_code' => $row['account_code'] ?? null,
            'account_name' => $row['account_name'] ?? null,
            'account_type' => $row['account_type'] ?? null,
            'description' => $row['description'] ?? null,
            'debit' => round((float)$row['debit'], 2),
            'credit' => round((float)$row['credit'], 2),
            'sort_order' => (int)$row['sort_order'],
        ];
    }
}
