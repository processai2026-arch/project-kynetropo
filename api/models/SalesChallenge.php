<?php
declare(strict_types=1);

/**
 * SalesChallenge — the "Challenge Accepted" lifecycle
 * (AVAILABLE → ACCEPTED → IN_PROGRESS → COMPLETED, or → EXPIRED at deadline).
 *
 * The BACKEND IS AUTHORITATIVE for expiry (spec §24/§26/§43): every read and
 * every write first runs sweepExpired(), which flips anything past its deadline
 * to 'expired' using the database clock. The frontend countdown is decoration —
 * an expired challenge can never be accepted or completed, even by a hand-
 * crafted API request, because the guard is re-evaluated inside the UPDATE.
 */
class SalesChallenge
{
    public const STATUSES   = ['available', 'accepted', 'in_progress', 'completed', 'expired', 'cancelled'];
    public const PRIORITIES = ['low', 'normal', 'high', 'critical'];

    /** Statuses that a deadline can still kill. */
    private const LIVE_STATUSES = ['available', 'accepted', 'in_progress'];

    // ── Server-authoritative expiry ─────────────────────────────────────────

    /**
     * Flips every past-deadline live challenge to EXPIRED using the DB clock.
     * Idempotent and cheap (indexed on tenant_id + deadline); called at the top
     * of every challenge endpoint so no read can ever return a stale status.
     */
    public static function sweepExpired(): int
    {
        $tenantId = Database::tenantId();

        $due = Database::fetchAll(
            "SELECT id, title, status, accepted_by FROM sales_challenges
              WHERE tenant_id = ? AND deadline <= NOW() AND status IN ('available','accepted','in_progress')",
            [$tenantId]
        );
        if (!$due) {
            return 0;
        }

        Database::execute(
            "UPDATE sales_challenges
                SET status = 'expired', expired_at = NOW()
              WHERE tenant_id = ? AND deadline <= NOW() AND status IN ('available','accepted','in_progress')",
            [$tenantId]
        );

        foreach ($due as $row) {
            self::logActivity((int)$row['id'], 'expired', null, 'Deadline reached (server time)');

            // Taking a challenge and missing the deadline destroys that
            // salesperson access to the app until an administrator restores it.
            // A challenge nobody accepted simply expires — there is nobody to
            // hold to it.
            if (in_array($row['status'], ['accepted', 'in_progress'], true) && !empty($row['accepted_by'])) {
                $locked = SalesLockout::lock(
                    (int)$row['accepted_by'],
                    (int)$row['id'],
                    'Challenge missed: ' . (string)$row['title']
                );
                if ($locked) {
                    self::logActivity(
                        (int)$row['id'],
                        'access_destroyed',
                        null,
                        'App access destroyed for the salesperson who accepted this challenge'
                    );
                }
            }
        }

        return count($due);
    }

    public static function serverTime(): string
    {
        $row = Database::fetch('SELECT NOW() AS now_ts');
        return (string)($row['now_ts'] ?? date('Y-m-d H:i:s'));
    }

    // ── Reads ───────────────────────────────────────────────────────────────

    /**
     * @param string $status one of self::STATUSES, or '' for all
     * @param array  $viewer the requesting user; non-managers only see challenges
     *                       offered to them (unassigned = offered to everyone)
     */
    /**
     * @param int|null $onlyForUser restricts the board to challenges this
     *   person set, took, or was offered — "Naresh's challenges" rather than
     *   the whole team's. Used by the read-only view of a colleague.
     */
    public static function all(string $status, array $viewer, bool $isManager, int $page = 1, int $limit = 100, ?int $onlyForUser = null): array
    {
        $page  = max(1, $page);
        $limit = min(300, max(1, $limit));

        $where  = ['c.tenant_id = ?'];
        $params = [Database::tenantId()];

        // The board is deliberately team-wide: everyone sees every challenge and
        // can follow the discussion on it. Who may ACCEPT one is a separate
        // question, answered by isOfferedTo() at accept time.

        if ($status !== '' && in_array($status, self::STATUSES, true)) {
            $where[]  = 'c.status = ?';
            $params[] = $status;
        }

        if ($onlyForUser !== null) {
            $where[]  = '(c.created_by = ? OR c.accepted_by = ? OR EXISTS (
                            SELECT 1 FROM sales_challenge_assignments a
                             WHERE a.challenge_id = c.id AND a.tenant_id = c.tenant_id AND a.user_id = ?))';
            array_push($params, $onlyForUser, $onlyForUser, $onlyForUser);
        }

        $whereClause = implode(' AND ', $where);

        $total = Database::count("SELECT COUNT(*) AS cnt FROM sales_challenges c WHERE $whereClause", $params);

        $rows = Database::fetchAll(
            "SELECT c.*, NOW() AS server_now,
                    ua.name AS accepted_by_name, uc.name AS completed_by_name,
                    ucr.name AS created_by_name, l.name AS lead_name, l.company AS lead_company
               FROM sales_challenges c
               LEFT JOIN users ua  ON ua.user_id  = c.accepted_by
               LEFT JOIN users uc  ON uc.user_id  = c.completed_by
               LEFT JOIN users ucr ON ucr.user_id = c.created_by
               LEFT JOIN sales_leads l ON l.id = c.lead_id AND l.tenant_id = c.tenant_id
              WHERE $whereClause
              ORDER BY FIELD(c.status,'in_progress','accepted','available','completed','expired','cancelled'),
                       c.deadline ASC
              LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );

        return [
            'rows'       => array_map([self::class, 'format'], $rows),
            'pagination' => [
                'page'        => $page,
                'limit'       => $limit,
                'total'       => $total,
                'total_pages' => (int)ceil($total / max(1, $limit)),
            ],
        ];
    }

    public static function findRaw(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM sales_challenges WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function find(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT c.*, NOW() AS server_now,
                    ua.name AS accepted_by_name, uc.name AS completed_by_name,
                    ucr.name AS created_by_name, l.name AS lead_name, l.company AS lead_company
               FROM sales_challenges c
               LEFT JOIN users ua  ON ua.user_id  = c.accepted_by
               LEFT JOIN users uc  ON uc.user_id  = c.completed_by
               LEFT JOIN users ucr ON ucr.user_id = c.created_by
               LEFT JOIN sales_leads l ON l.id = c.lead_id AND l.tenant_id = c.tenant_id
              WHERE c.id = ? AND c.tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
        if (!$row) {
            return null;
        }
        $data = self::format($row);
        $data['assignees'] = self::assignees($id);
        $data['activity']  = self::activity($id);
        return $data;
    }

    /** True when the challenge is offered to this user (or offered to everyone). */
    public static function isOfferedTo(int $challengeId, int $userId): bool
    {
        $any = Database::count(
            'SELECT COUNT(*) AS cnt FROM sales_challenge_assignments WHERE tenant_id = ? AND challenge_id = ?',
            [Database::tenantId(), $challengeId]
        );
        if ($any === 0) {
            return true;
        }
        return Database::count(
            'SELECT COUNT(*) AS cnt FROM sales_challenge_assignments WHERE tenant_id = ? AND challenge_id = ? AND user_id = ?',
            [Database::tenantId(), $challengeId, $userId]
        ) > 0;
    }

    public static function assignees(int $challengeId): array
    {
        $rows = Database::fetchAll(
            'SELECT a.user_id, u.name, u.email
               FROM sales_challenge_assignments a
               LEFT JOIN users u ON u.user_id = a.user_id
              WHERE a.tenant_id = ? AND a.challenge_id = ?',
            [Database::tenantId(), $challengeId]
        );
        return array_map(fn($r) => [
            'user_id' => (int)$r['user_id'],
            'name'    => $r['name'],
            'email'   => $r['email'],
        ], $rows);
    }

    public static function activity(int $challengeId): array
    {
        $rows = Database::fetchAll(
            'SELECT * FROM sales_challenge_activity
              WHERE tenant_id = ? AND challenge_id = ? ORDER BY created_at ASC, id ASC',
            [Database::tenantId(), $challengeId]
        );
        return array_map(fn($r) => [
            'id'         => (int)$r['id'],
            'action'     => $r['action'],
            'notes'      => $r['notes'],
            'actor_id'   => $r['actor_id'] !== null ? (int)$r['actor_id'] : null,
            'actor_name' => $r['actor_name'],
            'created_at' => $r['created_at'],
        ], $rows);
    }

    public static function counts(array $viewer, bool $isManager): array
    {
        $params = [Database::tenantId()];
        $extra  = '';
        if (!$isManager) {
            $userId   = isset($viewer['user_id']) ? (int)$viewer['user_id'] : 0;
            $extra    = ' AND (c.accepted_by = ? OR NOT EXISTS (SELECT 1 FROM sales_challenge_assignments a
                            WHERE a.challenge_id = c.id AND a.tenant_id = c.tenant_id)
                          OR EXISTS (SELECT 1 FROM sales_challenge_assignments a
                            WHERE a.challenge_id = c.id AND a.tenant_id = c.tenant_id AND a.user_id = ?))';
            $params[] = $userId;
            $params[] = $userId;
        }

        $row = Database::fetch(
            "SELECT
               SUM(c.status = 'available')   AS available,
               SUM(c.status = 'accepted')    AS accepted,
               SUM(c.status = 'in_progress') AS in_progress,
               SUM(c.status = 'completed')   AS completed,
               SUM(c.status = 'expired')     AS expired
             FROM sales_challenges c WHERE c.tenant_id = ?" . $extra,
            $params
        );

        return [
            'available'   => (int)($row['available']   ?? 0),
            'accepted'    => (int)($row['accepted']    ?? 0),
            'in_progress' => (int)($row['in_progress'] ?? 0),
            'completed'   => (int)($row['completed']   ?? 0),
            'expired'     => (int)($row['expired']     ?? 0),
        ];
    }

    // ── Writes ──────────────────────────────────────────────────────────────

    public static function create(array $data, ?int $createdBy): int
    {
        $id = Database::insert('sales_challenges', [
            'tenant_id'   => Database::tenantId(),
            'title'       => $data['title'],
            'description' => $data['description'] ?? null,
            'lead_id'     => !empty($data['lead_id'])   ? (int)$data['lead_id']   : null,
            'client_id'   => !empty($data['client_id']) ? (int)$data['client_id'] : null,
            'deadline'    => $data['deadline'],
            'priority'    => $data['priority'] ?? 'normal',
            'status'      => 'available',
            'created_by'  => $createdBy,
        ]);

        Database::execute(
            'UPDATE sales_challenges SET challenge_code = ? WHERE id = ? AND tenant_id = ?',
            ['CH-' . str_pad((string)$id, 5, '0', STR_PAD_LEFT), $id, Database::tenantId()]
        );

        return $id;
    }

    public static function update(int $id, array $data): void
    {
        $fields = [];
        $params = [];
        foreach (['title', 'description', 'deadline', 'priority', 'lead_id', 'client_id'] as $col) {
            if (!array_key_exists($col, $data)) {
                continue;
            }
            $value = in_array($col, ['lead_id', 'client_id'], true)
                ? (!empty($data[$col]) ? (int)$data[$col] : null)
                : $data[$col];
            $fields[] = "`$col` = ?";
            $params[] = $value;
        }
        if (!$fields) {
            return;
        }
        $params[] = $id;
        $params[] = Database::tenantId();
        Database::execute(
            'UPDATE sales_challenges SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?',
            $params
        );
    }

    public static function setAssignees(int $challengeId, array $userIds): void
    {
        $tenantId = Database::tenantId();
        Database::execute(
            'DELETE FROM sales_challenge_assignments WHERE tenant_id = ? AND challenge_id = ?',
            [$tenantId, $challengeId]
        );
        foreach (array_unique(array_map('intval', $userIds)) as $userId) {
            if ($userId <= 0) {
                continue;
            }
            Database::execute(
                'INSERT IGNORE INTO sales_challenge_assignments (tenant_id, challenge_id, user_id) VALUES (?, ?, ?)',
                [$tenantId, $challengeId, $userId]
            );
        }
    }

    /**
     * Accepts the challenge. The deadline guard lives inside the UPDATE so a
     * request racing the deadline cannot slip through: affected-rows = 0 means
     * it was already taken, already expired, or past its deadline.
     */
    public static function accept(int $id, int $userId): bool
    {
        return Database::execute(
            "UPDATE sales_challenges
                SET status = 'accepted', accepted_by = ?, accepted_at = NOW()
              WHERE id = ? AND tenant_id = ? AND status = 'available' AND deadline > NOW()",
            [$userId, $id, Database::tenantId()]
        ) > 0;
    }

    public static function start(int $id, int $userId): bool
    {
        return Database::execute(
            "UPDATE sales_challenges
                SET status = 'in_progress', started_at = NOW()
              WHERE id = ? AND tenant_id = ? AND status = 'accepted' AND accepted_by = ? AND deadline > NOW()",
            [$id, Database::tenantId(), $userId]
        ) > 0;
    }

    /** Completion is refused after the deadline — enforced in SQL, not the UI. */
    public static function complete(int $id, int $userId, ?string $notes): bool
    {
        return Database::execute(
            "UPDATE sales_challenges
                SET status = 'completed', completed_by = ?, completed_at = NOW(), completion_notes = ?
              WHERE id = ? AND tenant_id = ? AND status IN ('accepted','in_progress')
                AND accepted_by = ? AND deadline > NOW()",
            [$userId, $notes, $id, Database::tenantId(), $userId]
        ) > 0;
    }

    /** Manual expire (admin) — only valid once the deadline has actually passed. */
    public static function expire(int $id): bool
    {
        return Database::execute(
            "UPDATE sales_challenges
                SET status = 'expired', expired_at = NOW()
              WHERE id = ? AND tenant_id = ? AND status IN ('available','accepted','in_progress') AND deadline <= NOW()",
            [$id, Database::tenantId()]
        ) > 0;
    }

    public static function cancel(int $id): bool
    {
        return Database::execute(
            "UPDATE sales_challenges SET status = 'cancelled'
              WHERE id = ? AND tenant_id = ? AND status IN ('available','accepted','in_progress')",
            [$id, Database::tenantId()]
        ) > 0;
    }

    public static function logActivity(int $challengeId, string $action, ?array $actor, ?string $notes = null): void
    {
        Database::insert('sales_challenge_activity', [
            'tenant_id'    => Database::tenantId(),
            'challenge_id' => $challengeId,
            'action'       => $action,
            'notes'        => $notes,
            'actor_id'     => isset($actor['user_id']) ? (int)$actor['user_id'] : null,
            'actor_name'   => (string)($actor['name'] ?? 'system'),
        ]);
    }

    // ── Formatting ──────────────────────────────────────────────────────────

    public static function format(array $row): array
    {
        $serverNow = $row['server_now'] ?? date('Y-m-d H:i:s');
        $remaining = strtotime((string)$row['deadline']) - strtotime((string)$serverNow);

        return [
            'id'                 => (int)$row['id'],
            'challenge_code'     => $row['challenge_code'],
            'title'              => $row['title'],
            'description'        => $row['description'],
            'lead_id'            => $row['lead_id']   !== null ? (int)$row['lead_id']   : null,
            'lead_name'          => $row['lead_name']    ?? null,
            'lead_company'       => $row['lead_company'] ?? null,
            'client_id'          => $row['client_id'] !== null ? (int)$row['client_id'] : null,
            'deadline'           => $row['deadline'],
            'priority'           => $row['priority'],
            'status'             => $row['status'],
            'accepted_by'        => $row['accepted_by'] !== null ? (int)$row['accepted_by'] : null,
            'accepted_by_name'   => $row['accepted_by_name'] ?? null,
            'accepted_at'        => $row['accepted_at'],
            'started_at'         => $row['started_at'],
            'completed_by'       => $row['completed_by'] !== null ? (int)$row['completed_by'] : null,
            'completed_by_name'  => $row['completed_by_name'] ?? null,
            'completed_at'       => $row['completed_at'],
            'completion_notes'   => $row['completion_notes'],
            'expired_at'         => $row['expired_at'],
            'created_by'         => $row['created_by'] !== null ? (int)$row['created_by'] : null,
            'created_by_name'    => $row['created_by_name'] ?? null,
            'created_at'         => $row['created_at'],
            'updated_at'         => $row['updated_at'],
            // Authoritative clock data — the UI renders its countdown from these,
            // never from the device clock.
            'server_time'        => $serverNow,
            'seconds_remaining'  => max(0, (int)$remaining),
            'is_expired'         => $row['status'] === 'expired',
            'is_actionable'      => in_array($row['status'], self::LIVE_STATUSES, true) && $remaining > 0,
        ];
    }
}
