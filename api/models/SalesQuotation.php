<?php
declare(strict_types=1);

/**
 * SalesQuotation — the quotations sent to a lead, one row per round.
 *
 * The loop between the meeting and onboarding: sent, rejected, sent again,
 * accepted. Only the latest round can be answered, and a new round can only go
 * out once the last one was rejected — so the rows read as the story of the
 * deal, version by version.
 */
class SalesQuotation
{
    public const ANSWERS = ['rejected', 'accepted'];

    /** Every round for a lead, newest first. */
    public static function forLead(int $leadId): array
    {
        try {
            $rows = Database::fetchAll(
                'SELECT q.*, u.name AS created_by_name
                   FROM sales_quotations q
                   LEFT JOIN users u ON u.user_id = q.created_by
                  WHERE q.tenant_id = ? AND q.lead_id = ?
                  ORDER BY q.version DESC',
                [Database::tenantId(), $leadId]
            );
        } catch (\Throwable $e) {
            // Table not migrated yet: the lead still opens, with no rounds.
            error_log('[SalesQuotation] unavailable: ' . $e->getMessage());
            return [];
        }
        return array_map([self::class, 'format'], $rows);
    }

    public static function find(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM sales_quotations WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function latest(int $leadId): ?array
    {
        return Database::fetch(
            'SELECT * FROM sales_quotations WHERE tenant_id = ? AND lead_id = ? ORDER BY version DESC LIMIT 1',
            [Database::tenantId(), $leadId]
        );
    }

    public static function create(int $leadId, int $version, ?float $amount, string $sentOn, string $notes, ?int $userId): int
    {
        return Database::insert('sales_quotations', [
            'tenant_id'  => Database::tenantId(),
            'lead_id'    => $leadId,
            'version'    => $version,
            'amount'     => $amount,
            'sent_on'    => $sentOn,
            'notes'      => mb_substr($notes, 0, 500),
            'status'     => 'sent',
            'created_by' => $userId,
        ]);
    }

    public static function answer(int $id, string $answer, string $answeredOn, string $note): void
    {
        Database::execute(
            "UPDATE sales_quotations SET status = ?, answered_on = ?, answer_note = ?
              WHERE id = ? AND tenant_id = ? AND status = 'sent'",
            [$answer, $answeredOn, mb_substr($note, 0, 500), $id, Database::tenantId()]
        );
    }

    public static function remove(int $id): void
    {
        Database::execute('DELETE FROM sales_quotations WHERE id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
    }

    public static function format(array $row): array
    {
        return [
            'id'              => (int)$row['id'],
            'lead_id'         => (int)$row['lead_id'],
            'version'         => (int)$row['version'],
            'amount'          => $row['amount'] !== null ? (float)$row['amount'] : null,
            'sent_on'         => $row['sent_on'],
            'notes'           => (string)$row['notes'],
            'status'          => (string)$row['status'],
            'answered_on'     => $row['answered_on'],
            'answer_note'     => (string)$row['answer_note'],
            'created_by_name' => $row['created_by_name'] ?? null,
            'created_at'      => $row['created_at'],
        ];
    }
}
