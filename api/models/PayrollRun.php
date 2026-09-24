<?php
declare(strict_types=1);

/**
 * PayrollRun — the maker-checker lifecycle record for one tenant+month payroll run.
 * draft -> reviewed -> approved -> paid -> locked. Locked runs are immutable.
 */
class PayrollRun
{
    public const TRANSITIONS = [
        'draft'    => 'reviewed',
        'reviewed' => 'approved',
        'approved' => 'paid',
        'paid'     => 'locked',
    ];

    public static function find(string $month): ?array
    {
        return Database::fetch(
            'SELECT * FROM payroll_runs WHERE tenant_id = ? AND month = ? LIMIT 1',
            [Database::tenantId(), $month]
        );
    }

    /** Ensure a draft run row exists for this month; returns the run row. */
    public static function ensureDraft(string $month, int $userId, int $workingDays): array
    {
        $existing = self::find($month);
        if ($existing) return $existing;

        Database::execute(
            'INSERT INTO payroll_runs (tenant_id, month, run_status, working_days, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())',
            [Database::tenantId(), $month, 'draft', $workingDays, $userId]
        );
        return self::find($month);
    }

    /** Recompute + persist totals/employee_count on the run from current payroll rows. */
    public static function refreshTotals(string $month, int $workingDays): void
    {
        $summary = Database::fetch(
            'SELECT COUNT(*) AS cnt, COALESCE(SUM(gross_pay),0) AS gross,
                    COALESCE(SUM(deductions),0) AS ded, COALESCE(SUM(net_pay),0) AS net
             FROM payroll WHERE tenant_id = ? AND month = ?',
            [Database::tenantId(), $month]
        );

        Database::execute(
            'UPDATE payroll_runs
                SET working_days = ?, employee_count = ?, total_gross = ?, total_deductions = ?, total_net_pay = ?
              WHERE tenant_id = ? AND month = ?',
            [
                $workingDays,
                (int)($summary['cnt'] ?? 0),
                (float)($summary['gross'] ?? 0),
                (float)($summary['ded'] ?? 0),
                (float)($summary['net'] ?? 0),
                Database::tenantId(), $month,
            ]
        );
    }

    public static function isLocked(?array $run): bool
    {
        return $run !== null && ($run['run_status'] ?? '') === 'locked';
    }

    /**
     * Advance the run to the next lifecycle stage.
     * $actorId is the authenticated admin performing the action; when $requireDistinctFrom
     * is provided (maker-checker), the actor must differ from that prior actor.
     *
     * @throws RuntimeException on an invalid transition or same-actor maker-checker violation
     */
    public static function transition(
        string $month,
        string $toStatus,
        int $actorId,
        ?string $note = null,
        ?int $requireDistinctFrom = null
    ): array {
        $run = self::find($month);
        if (!$run) {
            throw new RuntimeException("No payroll run exists for {$month}. Run payroll first.");
        }

        $current = (string)$run['run_status'];
        $expectedNext = self::TRANSITIONS[$current] ?? null;
        if ($expectedNext !== $toStatus) {
            throw new RuntimeException("Cannot move payroll run from '{$current}' to '{$toStatus}'. Expected next stage: " . ($expectedNext ?? 'none — already at final stage'));
        }

        if ($requireDistinctFrom !== null && $requireDistinctFrom === $actorId) {
            throw new RuntimeException('Maker-checker control: the approver must be a different admin from the person who performed the previous step.');
        }

        $columns = [];
        $params  = [];

        switch ($toStatus) {
            case 'reviewed':
                $columns = ['run_status = ?', 'reviewed_by = ?', 'reviewed_at = NOW()', 'review_note = ?'];
                $params  = [$toStatus, $actorId, $note];
                break;
            case 'approved':
                $columns = ['run_status = ?', 'approved_by = ?', 'approved_at = NOW()', 'approve_note = ?'];
                $params  = [$toStatus, $actorId, $note];
                break;
            case 'paid':
                $columns = ['run_status = ?', 'paid_by = ?', 'paid_at = NOW()'];
                $params  = [$toStatus, $actorId];
                break;
            case 'locked':
                $columns = ['run_status = ?', 'locked_by = ?', 'locked_at = NOW()'];
                $params  = [$toStatus, $actorId];
                break;
            default:
                throw new RuntimeException('Unsupported payroll run stage.');
        }

        $params[] = Database::tenantId();
        $params[] = $month;

        Database::execute(
            'UPDATE payroll_runs SET ' . implode(', ', $columns) . ' WHERE tenant_id = ? AND month = ?',
            $params
        );

        Payroll::syncRunStatus($month, (int)$run['run_id'], $toStatus);

        return self::find($month);
    }

    public static function recordBankAdvice(string $month, int $actorId, int $employeeCount, float $totalAmount): void
    {
        $run = self::find($month);
        if (!$run) return;

        Database::execute(
            'UPDATE payroll_runs SET bank_advice_generated_at = NOW(), bank_advice_generated_by = ? WHERE tenant_id = ? AND month = ?',
            [$actorId, Database::tenantId(), $month]
        );

        Database::insertTenant('payroll_bank_advices', [
            'run_id'         => (int)$run['run_id'],
            'month'          => $month,
            'employee_count' => $employeeCount,
            'total_amount'   => $totalAmount,
            'generated_by'   => $actorId,
            'generated_at'   => date('Y-m-d H:i:s'),
        ]);
    }

    public static function format(array $row, array $actorNames = []): array
    {
        $name = static fn(?int $id) => $id !== null ? ($actorNames[$id] ?? ('User #' . $id)) : null;

        return [
            'runId'            => (int)$row['run_id'],
            'month'            => $row['month'],
            'runStatus'        => $row['run_status'],
            'workingDays'      => (int)$row['working_days'],
            'employeeCount'    => (int)$row['employee_count'],
            'totalGross'       => (float)$row['total_gross'],
            'totalDeductions'  => (float)$row['total_deductions'],
            'totalNetPay'      => (float)$row['total_net_pay'],
            'createdBy'        => $row['created_by'] !== null ? (int)$row['created_by'] : null,
            'createdByName'    => $name($row['created_by'] !== null ? (int)$row['created_by'] : null),
            'createdAt'        => $row['created_at'] ? date('c', strtotime($row['created_at'])) : null,
            'reviewedBy'       => $row['reviewed_by'] !== null ? (int)$row['reviewed_by'] : null,
            'reviewedByName'   => $name($row['reviewed_by'] !== null ? (int)$row['reviewed_by'] : null),
            'reviewedAt'       => $row['reviewed_at'] ? date('c', strtotime($row['reviewed_at'])) : null,
            'reviewNote'       => $row['review_note'] ?? null,
            'approvedBy'       => $row['approved_by'] !== null ? (int)$row['approved_by'] : null,
            'approvedByName'   => $name($row['approved_by'] !== null ? (int)$row['approved_by'] : null),
            'approvedAt'       => $row['approved_at'] ? date('c', strtotime($row['approved_at'])) : null,
            'approveNote'      => $row['approve_note'] ?? null,
            'paidBy'           => $row['paid_by'] !== null ? (int)$row['paid_by'] : null,
            'paidByName'       => $name($row['paid_by'] !== null ? (int)$row['paid_by'] : null),
            'paidAt'           => $row['paid_at'] ? date('c', strtotime($row['paid_at'])) : null,
            'lockedBy'         => $row['locked_by'] !== null ? (int)$row['locked_by'] : null,
            'lockedByName'     => $name($row['locked_by'] !== null ? (int)$row['locked_by'] : null),
            'lockedAt'         => $row['locked_at'] ? date('c', strtotime($row['locked_at'])) : null,
            'bankAdviceGeneratedAt' => $row['bank_advice_generated_at'] ? date('c', strtotime($row['bank_advice_generated_at'])) : null,
            'isLocked'         => $row['run_status'] === 'locked',
            'nextStatus'       => self::TRANSITIONS[$row['run_status']] ?? null,
        ];
    }

    /** Resolve display names for a set of user ids (for the run actor fields). */
    public static function actorNames(array $userIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $userIds))));
        if (empty($ids)) return [];

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $rows = Database::fetchAll("SELECT user_id, name FROM users WHERE user_id IN ($placeholders)", $ids);

        $map = [];
        foreach ($rows as $r) $map[(int)$r['user_id']] = $r['name'];
        return $map;
    }
}
