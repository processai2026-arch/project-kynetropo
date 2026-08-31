<?php
declare(strict_types=1);

class JournalEntry
{
    public static function all(array $filters = []): array
    {
        $where = ['je.tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['status']) && in_array($filters['status'], ['draft', 'posted'], true)) {
            $where[] = 'je.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['from'])) {
            $where[] = 'je.entry_date >= ?';
            $params[] = $filters['from'];
        }
        if (!empty($filters['to'])) {
            $where[] = 'je.entry_date <= ?';
            $params[] = $filters['to'];
        }

        $rows = Database::fetchAll(
            'SELECT je.*,
                    COALESCE(SUM(jl.debit), 0) AS total_debit,
                    COALESCE(SUM(jl.credit), 0) AS total_credit,
                    COUNT(jl.journal_line_id) AS line_count
             FROM journal_entries je
             LEFT JOIN journal_lines jl
               ON jl.journal_entry_id = je.journal_entry_id AND jl.tenant_id = je.tenant_id
             WHERE ' . implode(' AND ', $where) . '
             GROUP BY je.journal_entry_id
             ORDER BY je.entry_date DESC, je.journal_entry_id DESC',
            $params
        );

        return array_map([self::class, 'format'], $rows);
    }

    public static function find(int $id, bool $withLines = true): ?array
    {
        $row = Database::fetch(
            'SELECT je.*,
                    COALESCE(SUM(jl.debit), 0) AS total_debit,
                    COALESCE(SUM(jl.credit), 0) AS total_credit,
                    COUNT(jl.journal_line_id) AS line_count
             FROM journal_entries je
             LEFT JOIN journal_lines jl
               ON jl.journal_entry_id = je.journal_entry_id AND jl.tenant_id = je.tenant_id
             WHERE je.journal_entry_id = ? AND je.tenant_id = ?
             GROUP BY je.journal_entry_id
             LIMIT 1',
            [$id, Database::tenantId()]
        );
        if (!$row) {
            return null;
        }

        $entry = self::format($row);
        if ($withLines) {
            $entry['lines'] = JournalLine::forEntry($id);
        }
        return $entry;
    }

    public static function create(array $data, array $lines): int
    {
        Database::beginTransaction();
        try {
            $id = Database::insertTenant('journal_entries', [
                'entry_number' => self::nextNumber(),
                'entry_date' => $data['entry_date'],
                'reference' => $data['reference'] ?: null,
                'description' => $data['description'],
                'status' => 'draft',
                'created_by' => $data['created_by'] ?: null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            foreach ($lines as $index => $line) {
                JournalLine::create($id, $line, $index + 1);
            }
            Database::commit();
            return $id;
        } catch (Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }

    public static function post(int $id, ?int $actorId): void
    {
        Database::beginTransaction();
        try {
            $entry = Database::fetch(
                'SELECT journal_entry_id, status
                 FROM journal_entries
                 WHERE journal_entry_id = ? AND tenant_id = ?
                 FOR UPDATE',
                [$id, Database::tenantId()]
            );
            if (!$entry) {
                Database::rollBack();
                Response::error('Journal entry not found', 404);
            }
            if ($entry['status'] === 'posted') {
                Database::rollBack();
                Response::error('Journal entry is already posted', 409);
            }

            $totals = Database::fetch(
                'SELECT COUNT(*) AS line_count,
                        COALESCE(SUM(debit), 0) AS total_debit,
                        COALESCE(SUM(credit), 0) AS total_credit
                 FROM journal_lines
                 WHERE journal_entry_id = ? AND tenant_id = ?',
                [$id, Database::tenantId()]
            );
            $debit = round((float)($totals['total_debit'] ?? 0), 2);
            $credit = round((float)($totals['total_credit'] ?? 0), 2);
            if ((int)($totals['line_count'] ?? 0) < 2 || $debit <= 0 || abs($debit - $credit) > 0.005) {
                Database::rollBack();
                Response::error('Journal entry must contain at least two balanced lines before posting', 422);
            }

            Database::execute(
                'UPDATE journal_entries
                 SET status = "posted", posted_by = ?, posted_at = NOW(), updated_at = NOW()
                 WHERE journal_entry_id = ? AND tenant_id = ? AND status = "draft"',
                [$actorId, $id, Database::tenantId()]
            );
            Database::commit();
        } catch (Throwable $e) {
            if (Database::getInstance()->inTransaction()) {
                Database::rollBack();
            }
            throw $e;
        }
    }

    private static function nextNumber(): string
    {
        return 'JE-' . date('Ymd-His') . '-' . strtoupper(bin2hex(random_bytes(2)));
    }

    public static function format(array $row): array
    {
        return [
            'journal_entry_id' => (int)$row['journal_entry_id'],
            'entry_number' => (string)$row['entry_number'],
            'entry_date' => (string)$row['entry_date'],
            'reference' => $row['reference'] ?? null,
            'description' => (string)$row['description'],
            'status' => (string)$row['status'],
            'total_debit' => round((float)($row['total_debit'] ?? 0), 2),
            'total_credit' => round((float)($row['total_credit'] ?? 0), 2),
            'line_count' => (int)($row['line_count'] ?? 0),
            'created_by' => isset($row['created_by']) ? (int)$row['created_by'] : null,
            'posted_by' => isset($row['posted_by']) ? (int)$row['posted_by'] : null,
            'posted_at' => $row['posted_at'] ?? null,
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }
}
