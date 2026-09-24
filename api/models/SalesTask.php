<?php
declare(strict_types=1);

/**
 * SalesTask — "give someone a job and be told when it is done".
 *
 * A task has exactly two people who matter: the ASSIGNEE, who is the only one
 * who can finish it, and the ASSIGNER, who is the one told when it is finished.
 * Everything else (admins, the rest of the team) can read it and comment on it
 * so the work is visible, but neither of those two roles can be taken over by
 * being an administrator — an admin can cancel or reassign a task, which is a
 * different act from silently completing someone else's work.
 *
 * OPEN → IN_PROGRESS → COMPLETED, with CANCELLED reachable from any live state
 * and reopening allowed from COMPLETED. Nothing is deleted: handing work back
 * is an ordinary correction, and the history is what makes it reviewable.
 */
class SalesTask
{
    public const STATUSES   = ['open', 'in_progress', 'completed', 'cancelled'];
    public const PRIORITIES = ['low', 'normal', 'high', 'critical'];

    /** Statuses where the task is still someone's outstanding work. */
    public const LIVE_STATUSES = ['open', 'in_progress'];

    // ── Reads ───────────────────────────────────────────────────────────────

    /**
     * @param array    $filters      status, assigned_to, assigned_by, lead_id, bucket, search
     * @param int      $userId       whose "mine" and "given" buckets these are
     * @param int|null $onlyForUser  restricts the whole list to one person's
     *   tasks — used when reading a colleague's board, where showing the team's
     *   would answer a question nobody asked
     *
     * The board itself is team-wide: work everyone can see is work nobody has
     * to ask about. Who may act on a task is a separate question, answered per
     * task by the controller and re-checked in the SQL of each action.
     */
    public static function all(array $filters, int $userId, ?int $onlyForUser = null, int $page = 1, int $limit = 100): array
    {
        $page  = max(1, $page);
        $limit = min(300, max(1, $limit));
        $today = date('Y-m-d');

        $where  = ['t.tenant_id = ?'];
        $params = [Database::tenantId()];

        if ($onlyForUser !== null) {
            $where[]  = '(t.assigned_to = ? OR t.assigned_by = ?)';
            $params[] = $onlyForUser;
            $params[] = $onlyForUser;
        }

        $status = (string)($filters['status'] ?? '');
        if ($status !== '' && in_array($status, self::STATUSES, true)) {
            $where[]  = 't.status = ?';
            $params[] = $status;
        }

        // Buckets answer the two questions the page is actually for: what do I
        // owe, and what am I waiting on?
        switch ((string)($filters['bucket'] ?? '')) {
            case 'mine':
                $where[]  = "t.assigned_to = ? AND t.status IN ('open','in_progress')";
                $params[] = $userId;
                break;
            case 'given':
                $where[]  = "t.assigned_by = ? AND t.status IN ('open','in_progress')";
                $params[] = $userId;
                break;
            case 'team':
                // Everything still outstanding, whoever it belongs to.
                $where[] = "t.status IN ('open','in_progress')";
                break;
            case 'overdue':
                $where[]  = "t.status IN ('open','in_progress') AND t.due_date IS NOT NULL AND t.due_date < ?";
                $params[] = $today;
                break;
            case 'completed':
                $where[] = "t.status = 'completed'";
                break;
        }

        if (!empty($filters['assigned_to'])) {
            $where[]  = 't.assigned_to = ?';
            $params[] = (int)$filters['assigned_to'];
        }
        if (!empty($filters['assigned_by'])) {
            $where[]  = 't.assigned_by = ?';
            $params[] = (int)$filters['assigned_by'];
        }
        if (!empty($filters['lead_id'])) {
            $where[]  = 't.lead_id = ?';
            $params[] = (int)$filters['lead_id'];
        }
        if (!empty($filters['search'])) {
            $where[]  = '(t.title LIKE ? OR t.description LIKE ?)';
            $like     = '%' . $filters['search'] . '%';
            $params[] = $like;
            $params[] = $like;
        }

        $whereClause = implode(' AND ', $where);

        $total = Database::count("SELECT COUNT(*) AS cnt FROM sales_tasks t WHERE $whereClause", $params);

        $rows = Database::fetchAll(
            "SELECT t.*, NOW() AS server_now,
                    ua.name AS assignee_current_name, ub.name AS assigner_current_name,
                    l.name AS lead_name, l.company AS lead_company,
                    (SELECT COUNT(*) FROM sales_comments sc
                      WHERE sc.tenant_id = t.tenant_id AND sc.entity_type = 'task'
                        AND sc.entity_id = t.id AND sc.deleted_at IS NULL) AS comment_count
               FROM sales_tasks t
               LEFT JOIN users ua ON ua.user_id = t.assigned_to
               LEFT JOIN users ub ON ub.user_id = t.assigned_by
               LEFT JOIN sales_leads l ON l.id = t.lead_id AND l.tenant_id = t.tenant_id
              WHERE $whereClause
              ORDER BY FIELD(t.status,'in_progress','open','completed','cancelled'),
                       (t.due_date IS NULL), t.due_date ASC, (t.due_time IS NULL), t.due_time ASC, t.id DESC
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

    /** Badge counts for the tabs. Same scoping rule as all(). */
    public static function counts(int $userId, ?int $onlyForUser = null): array
    {
        $today  = date('Y-m-d');
        $params = [$today, Database::tenantId()];
        $extra  = '';
        if ($onlyForUser !== null) {
            $extra    = ' AND (t.assigned_to = ? OR t.assigned_by = ?)';
            $params[] = $onlyForUser;
            $params[] = $onlyForUser;
        }

        $row = Database::fetch(
            "SELECT
               SUM(t.status IN ('open','in_progress'))                                       AS live,
               SUM(t.status IN ('open','in_progress') AND t.due_date IS NOT NULL
                   AND t.due_date < ?)                                                       AS overdue,
               SUM(t.status = 'completed')                                                   AS completed,
               SUM(t.status = 'cancelled')                                                   AS cancelled
             FROM sales_tasks t WHERE t.tenant_id = ?" . $extra,
            $params
        );

        // "Mine" and "given" are always about the caller, whatever their scope.
        $mine = Database::count(
            "SELECT COUNT(*) AS cnt FROM sales_tasks
              WHERE tenant_id = ? AND assigned_to = ? AND status IN ('open','in_progress')",
            [Database::tenantId(), $userId]
        );
        $given = Database::count(
            "SELECT COUNT(*) AS cnt FROM sales_tasks
              WHERE tenant_id = ? AND assigned_by = ? AND status IN ('open','in_progress')",
            [Database::tenantId(), $userId]
        );

        return [
            'mine'      => $mine,
            'given'     => $given,
            // The Everyone tab and "live" ask the same question of the same
            // rows; one column answers both.
            'team'      => (int)($row['live']      ?? 0),
            'live'      => (int)($row['live']      ?? 0),
            'overdue'   => (int)($row['overdue']   ?? 0),
            'completed' => (int)($row['completed'] ?? 0),
            'cancelled' => (int)($row['cancelled'] ?? 0),
        ];
    }

    public static function findRaw(int $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM sales_tasks WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
    }

    public static function find(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT t.*, NOW() AS server_now,
                    ua.name AS assignee_current_name, ub.name AS assigner_current_name,
                    l.name AS lead_name, l.company AS lead_company
               FROM sales_tasks t
               LEFT JOIN users ua ON ua.user_id = t.assigned_to
               LEFT JOIN users ub ON ub.user_id = t.assigned_by
               LEFT JOIN sales_leads l ON l.id = t.lead_id AND l.tenant_id = t.tenant_id
              WHERE t.id = ? AND t.tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
        if (!$row) {
            return null;
        }
        $data = self::format($row);
        $data['activity'] = self::activity($id);
        return $data;
    }

    public static function activity(int $taskId): array
    {
        $rows = Database::fetchAll(
            'SELECT * FROM sales_task_activity
              WHERE tenant_id = ? AND task_id = ? ORDER BY created_at ASC, id ASC',
            [Database::tenantId(), $taskId]
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

    // ── Writes ──────────────────────────────────────────────────────────────

    public static function create(array $data, ?array $creator): int
    {
        $id = Database::insert('sales_tasks', [
            'tenant_id'        => Database::tenantId(),
            'title'            => mb_substr(trim((string)$data['title']), 0, 200),
            'description'      => $data['description'] ?? null,
            'assigned_to'      => (int)$data['assigned_to'],
            'assigned_to_name' => mb_substr((string)($data['assigned_to_name'] ?? ''), 0, 200),
            'assigned_by'      => isset($creator['user_id']) ? (int)$creator['user_id'] : null,
            'assigned_by_name' => mb_substr((string)($creator['name'] ?? ''), 0, 200),
            'lead_id'          => !empty($data['lead_id']) ? (int)$data['lead_id'] : null,
            'due_date'         => $data['due_date'] ?: null,
            'due_time'         => $data['due_time'] ?: null,
            'priority'         => $data['priority'] ?? 'normal',
            'status'           => 'open',
            'created_by'       => isset($creator['user_id']) ? (int)$creator['user_id'] : null,
        ]);

        Database::execute(
            'UPDATE sales_tasks SET task_code = ? WHERE id = ? AND tenant_id = ?',
            ['TK-' . str_pad((string)$id, 5, '0', STR_PAD_LEFT), $id, Database::tenantId()]
        );

        return $id;
    }

    public static function update(int $id, array $data): void
    {
        $fields = [];
        $params = [];
        foreach (['title', 'description', 'due_date', 'due_time', 'priority', 'lead_id',
                  'assigned_to', 'assigned_to_name'] as $col) {
            if (!array_key_exists($col, $data)) {
                continue;
            }
            $value = in_array($col, ['lead_id', 'assigned_to'], true)
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
            'UPDATE sales_tasks SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?',
            $params
        );
    }

    /** The assignee picks it up. Guarded in SQL so only they can. */
    public static function start(int $id, int $userId): bool
    {
        return Database::execute(
            "UPDATE sales_tasks SET status = 'in_progress', started_at = COALESCE(started_at, NOW())
              WHERE id = ? AND tenant_id = ? AND status = 'open' AND assigned_to = ?",
            [$id, Database::tenantId(), $userId]
        ) > 0;
    }

    /**
     * The assignee says it is done. The `assigned_to = ?` guard lives in the
     * UPDATE, not only in the controller: completing someone else's task is the
     * one thing this module must never allow by accident.
     */
    public static function complete(int $id, int $userId, ?string $notes): bool
    {
        return Database::execute(
            "UPDATE sales_tasks
                SET status = 'completed', completed_at = NOW(), completed_by = ?, completion_notes = ?
              WHERE id = ? AND tenant_id = ? AND status IN ('open','in_progress') AND assigned_to = ?",
            [$userId, $notes, $id, Database::tenantId(), $userId]
        ) > 0;
    }

    /** Hand it back — the assigner's correction when the work is not actually done. */
    public static function reopen(int $id): bool
    {
        return Database::execute(
            "UPDATE sales_tasks
                SET status = 'open', completed_at = NULL, completed_by = NULL,
                    reviewed_at = NULL, reviewed_by = NULL
              WHERE id = ? AND tenant_id = ? AND status = 'completed'",
            [$id, Database::tenantId()]
        ) > 0;
    }

    /** The assigner accepts the work. Ends the task's life without erasing it. */
    public static function acknowledge(int $id, int $userId): bool
    {
        return Database::execute(
            "UPDATE sales_tasks SET reviewed_at = NOW(), reviewed_by = ?
              WHERE id = ? AND tenant_id = ? AND status = 'completed' AND reviewed_at IS NULL",
            [$userId, $id, Database::tenantId()]
        ) > 0;
    }

    public static function cancel(int $id, int $userId): bool
    {
        return Database::execute(
            "UPDATE sales_tasks SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = ?
              WHERE id = ? AND tenant_id = ? AND status IN ('open','in_progress')",
            [$userId, $id, Database::tenantId()]
        ) > 0;
    }

    /** Undo a cancellation — cancelling the wrong task should not be final. */
    public static function restore(int $id): bool
    {
        return Database::execute(
            "UPDATE sales_tasks SET status = 'open', cancelled_at = NULL, cancelled_by = NULL
              WHERE id = ? AND tenant_id = ? AND status = 'cancelled'",
            [$id, Database::tenantId()]
        ) > 0;
    }

    public static function logActivity(int $taskId, string $action, ?array $actor, ?string $notes = null): void
    {
        Database::insert('sales_task_activity', [
            'tenant_id'  => Database::tenantId(),
            'task_id'    => $taskId,
            'action'     => $action,
            'notes'      => $notes,
            'actor_id'   => isset($actor['user_id']) ? (int)$actor['user_id'] : null,
            'actor_name' => (string)($actor['name'] ?? 'system'),
        ]);
    }

    // ── Formatting ──────────────────────────────────────────────────────────

    public static function format(array $row): array
    {
        $today   = substr((string)($row['server_now'] ?? date('Y-m-d H:i:s')), 0, 10);
        $due     = $row['due_date'] ?? null;
        $isLive  = in_array($row['status'], self::LIVE_STATUSES, true);

        return [
            'id'               => (int)$row['id'],
            'task_code'        => $row['task_code'],
            'title'            => $row['title'],
            'description'      => $row['description'],
            'assigned_to'      => (int)$row['assigned_to'],
            // The current name wins over the stored one: people get renamed, and
            // a task should not keep showing who they used to be.
            'assigned_to_name' => $row['assignee_current_name'] ?? $row['assigned_to_name'],
            'assigned_by'      => $row['assigned_by'] !== null ? (int)$row['assigned_by'] : null,
            'assigned_by_name' => $row['assigner_current_name'] ?? $row['assigned_by_name'],
            'lead_id'          => $row['lead_id'] !== null ? (int)$row['lead_id'] : null,
            'lead_name'        => $row['lead_name']    ?? null,
            'lead_company'     => $row['lead_company'] ?? null,
            'due_date'         => $due,
            'due_time'         => $row['due_time'],
            'priority'         => $row['priority'],
            'status'           => $row['status'],
            'started_at'       => $row['started_at'],
            'completed_at'     => $row['completed_at'],
            'completed_by'     => $row['completed_by'] !== null ? (int)$row['completed_by'] : null,
            'completion_notes' => $row['completion_notes'],
            'reviewed_at'      => $row['reviewed_at'],
            'reviewed_by'      => $row['reviewed_by'] !== null ? (int)$row['reviewed_by'] : null,
            'cancelled_at'     => $row['cancelled_at'],
            'created_at'       => $row['created_at'],
            'updated_at'       => $row['updated_at'],
            'comment_count'    => isset($row['comment_count']) ? (int)$row['comment_count'] : 0,
            // Overdue is decided against the SERVER date, like every other date
            // in this module — the device clock is never consulted.
            'is_overdue'       => $isLive && $due !== null && (string)$due < $today,
            'is_live'          => $isLive,
        ];
    }
}
