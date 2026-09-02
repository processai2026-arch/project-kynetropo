<?php
declare(strict_types=1);

/**
 * Sales Dashboard Controller — answers "what do I need to do today?".
 *
 *   GET /admin/sales/dashboard — today's/overdue/upcoming follow-ups, today's
 *                                and upcoming meetings, lead temperature
 *                                summary, active challenges
 *   GET /admin/sales/activity  — recent lead activity across the pipeline
 *   GET /admin/sales/feed      — one merged live feed: leads, challenges, comments
 *
 * Everything is scoped to what the requesting user is allowed to see.
 */
class AdminSalesDashboardController
{
    public function index(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.dashboard.view');
        SalesChallenge::sweepExpired();

        $scope    = SalesPermissions::leadScope($request->user);
        $tenantId = Database::tenantId();

        // Viewing a colleague answers every question as them: a manager's
        // team-wide totals would drown out the one person being looked at.
        $viewing   = SalesViewAs::current();
        $isManager = $viewing === null && SalesPermissions::has($request->user, 'sales.challenges.manage');
        $subject   = $viewing !== null ? ['user_id' => (int)$viewing['user_id']] : $request->user;

        $followupCounts = SalesFollowup::counts($scope);
        $meetingCounts  = SalesMeeting::counts($scope);

        // Lead temperature summary
        $leadParams = [$tenantId];
        $leadExtra  = '';
        if ($scope['sql'] !== '') {
            $leadExtra    = ' AND l.assigned_to = ?';
            $leadParams[] = $scope['params'][0];
        }
        $leadRow = Database::fetch(
            "SELECT COUNT(*) AS total,
                    SUM(l.temperature = 'hot')      AS hot,
                    SUM(l.temperature = 'warm')     AS warm,
                    SUM(l.temperature = 'cold')     AS cold,
                    SUM(l.status = 'converted')     AS converted
               FROM sales_leads l
              WHERE l.tenant_id = ?" . $leadExtra,
            $leadParams
        );

        $challengeCounts = SalesChallenge::counts($subject, $isManager);

        $userId     = SalesViewAs::subjectId($request->user);
        $seeAllTask = $viewing === null && SalesPermissions::has($request->user, 'sales.tasks.manage');
        $taskCounts = SalesPermissions::has($request->user, 'sales.tasks.view')
            ? SalesTask::counts($userId, $seeAllTask)
            : ['mine' => 0, 'given' => 0, 'live' => 0, 'overdue' => 0, 'completed' => 0, 'cancelled' => 0];

        Response::success([
            'server_time' => SalesChallenge::serverTime(),
            'summary'     => [
                'total_leads'       => (int)($leadRow['total']     ?? 0),
                'hot'               => (int)($leadRow['hot']       ?? 0),
                'warm'              => (int)($leadRow['warm']      ?? 0),
                'cold'              => (int)($leadRow['cold']      ?? 0),
                'converted'         => (int)($leadRow['converted'] ?? 0),
                'followups_today'   => $followupCounts['today'],
                'followups_overdue' => $followupCounts['overdue'],
                'followups_upcoming'=> $followupCounts['upcoming'],
                'meetings_today'    => $meetingCounts['today'],
                'meetings_upcoming' => $meetingCounts['upcoming'],
                'active_challenges' => $challengeCounts['accepted'] + $challengeCounts['in_progress'],
                'tasks_mine'        => $taskCounts['mine'],
                'tasks_given'       => $taskCounts['given'],
                'tasks_overdue'     => $taskCounts['overdue'],
            ],
            'followups' => [
                'today'    => SalesFollowup::all('today',    [], $scope, 1, 20)['rows'],
                'overdue'  => SalesFollowup::all('overdue',  [], $scope, 1, 20)['rows'],
                'upcoming' => SalesFollowup::all('upcoming', [], $scope, 1, 20)['rows'],
            ],
            'meetings' => [
                'today'    => SalesMeeting::all(['status' => 'scheduled', 'date_from' => date('Y-m-d'), 'date_to' => date('Y-m-d')], $scope, 1, 20)['rows'],
                'upcoming' => SalesMeeting::all(['status' => 'scheduled', 'date_from' => date('Y-m-d', strtotime('+1 day'))], $scope, 1, 20)['rows'],
            ],
            'hot_leads'  => SalesLead::all(['temperature' => 'hot'], $scope, 1, 10)['rows'],
            'tasks'      => [
                'counts' => $taskCounts,
                // What I owe, then what I am waiting on — the only two task
                // questions a dashboard is ever asked.
                'mine'   => SalesPermissions::has($request->user, 'sales.tasks.view')
                            ? SalesTask::all(['bucket' => 'mine'], $userId, $seeAllTask, 1, 10)['rows'] : [],
                'given'  => SalesPermissions::has($request->user, 'sales.tasks.view')
                            ? SalesTask::all(['bucket' => 'given'], $userId, $seeAllTask, 1, 10)['rows'] : [],
            ],
            'challenges' => [
                'counts' => $challengeCounts,
                'active' => SalesChallenge::all('in_progress', $subject, $isManager, 1, 5, SalesViewAs::userId())['rows'],
                'available' => SalesChallenge::all('available', $subject, $isManager, 1, 5, SalesViewAs::userId())['rows'],
            ],
        ]);
    }

    public function activity(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.dashboard.view');

        $scope = SalesPermissions::leadScope($request->user);
        Response::success(SalesActivity::recent((int)$request->query('limit', 50), $scope));
    }

    /**
     * GET /admin/sales/feed
     *
     * One merged stream of everything happening in the module — lead activity,
     * challenge activity and comments — newest first. This is what the desktop
     * watches: a manager should not have to open three screens to see that a
     * call was logged, a challenge was accepted and someone asked a question
     * about a quotation.
     *
     * `since` (a server timestamp from a previous response) returns only what
     * has happened since, so the desktop can poll cheaply. Lead-scoped users
     * still only see their own leads; challenge events are team-wide.
     */
    public function feed(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.dashboard.view');

        $limit    = max(1, min(200, (int)$request->query('limit', 60)));
        $since    = (string)$request->query('since', '');
        $tenantId = Database::tenantId();
        $scope    = SalesPermissions::leadScope($request->user);
        $sinceOk  = $since !== '' && preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $since) === 1;

        // ── Lead activity (calls, follow-ups, meetings, conversions, comments)
        $where  = 'a.tenant_id = ?';
        $params = [$tenantId];
        if ($scope['sql'] !== '') {
            $where   .= ' AND l.assigned_to = ?';
            $params[] = $scope['params'][0];
        }
        if ($sinceOk) {
            $where   .= ' AND a.occurred_at > ?';
            $params[] = $since;
        }
        $events = [];
        foreach (Database::fetchAll(
            "SELECT a.id, a.activity_type, a.title, a.description, a.actor_id, a.actor_name,
                    a.occurred_at, a.lead_id, l.name AS lead_name, l.company AS lead_company
               FROM sales_lead_activities a
               JOIN sales_leads l ON l.id = a.lead_id AND l.tenant_id = a.tenant_id
              WHERE $where
              ORDER BY a.occurred_at DESC, a.id DESC
              LIMIT $limit",
            $params
        ) as $r) {
            $events[] = [
                'key'         => 'lead_activity:' . $r['id'],
                'source'      => 'lead',
                'type'        => $r['activity_type'],
                'title'       => $r['title'],
                'description' => $r['description'],
                'actor_id'    => $r['actor_id'] !== null ? (int)$r['actor_id'] : null,
                'actor_name'  => $r['actor_name'],
                'subject'     => $r['lead_company'] ?: $r['lead_name'],
                'url'         => '/sales/leads/' . (int)$r['lead_id'],
                'at'          => $r['occurred_at'],
            ];
        }

        // ── Challenge activity — team-wide, so everyone sees the same board.
        if (SalesPermissions::has($request->user, 'sales.challenges.view')) {
            $cWhere  = 'ca.tenant_id = ?';
            $cParams = [$tenantId];
            if ($sinceOk) {
                $cWhere   .= ' AND ca.created_at > ?';
                $cParams[] = $since;
            }
            foreach (Database::fetchAll(
                "SELECT ca.id, ca.action, ca.notes, ca.actor_id, ca.actor_name, ca.created_at,
                        c.id AS challenge_id, c.title
                   FROM sales_challenge_activity ca
                   JOIN sales_challenges c ON c.id = ca.challenge_id AND c.tenant_id = ca.tenant_id
                  WHERE $cWhere
                  ORDER BY ca.created_at DESC, ca.id DESC
                  LIMIT $limit",
                $cParams
            ) as $r) {
                $events[] = [
                    'key'         => 'challenge_activity:' . $r['id'],
                    'source'      => 'challenge',
                    'type'        => 'challenge_' . $r['action'],
                    'title'       => 'Challenge ' . str_replace('_', ' ', (string)$r['action']),
                    'description' => $r['notes'],
                    'actor_id'    => $r['actor_id'] !== null ? (int)$r['actor_id'] : null,
                    'actor_name'  => $r['actor_name'],
                    'subject'     => $r['title'],
                    'url'         => '/sales/challenges/' . (int)$r['challenge_id'],
                    'at'          => $r['created_at'],
                ];
            }
        }

        // ── Task activity — only the tasks this user gave or was given, unless
        // they administer tasks. The feed must never become a way to read work
        // between two other people.
        if (SalesPermissions::has($request->user, 'sales.tasks.view')) {
            $userId  = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
            $tWhere  = 'ta.tenant_id = ?';
            $tParams = [$tenantId];
            if (!SalesPermissions::has($request->user, 'sales.tasks.manage')) {
                $tWhere   .= ' AND (t.assigned_to = ? OR t.assigned_by = ?)';
                $tParams[] = $userId;
                $tParams[] = $userId;
            }
            if ($sinceOk) {
                $tWhere   .= ' AND ta.created_at > ?';
                $tParams[] = $since;
            }
            foreach (Database::fetchAll(
                "SELECT ta.id, ta.action, ta.notes, ta.actor_id, ta.actor_name, ta.created_at,
                        t.id AS task_id, t.title, t.assigned_to_name
                   FROM sales_task_activity ta
                   JOIN sales_tasks t ON t.id = ta.task_id AND t.tenant_id = ta.tenant_id
                  WHERE $tWhere
                  ORDER BY ta.created_at DESC, ta.id DESC
                  LIMIT $limit",
                $tParams
            ) as $r) {
                $events[] = [
                    'key'         => 'task_activity:' . $r['id'],
                    'source'      => 'task',
                    'type'        => 'task_' . $r['action'],
                    'title'       => 'Task ' . str_replace('_', ' ', (string)$r['action']),
                    'description' => $r['notes'],
                    'actor_id'    => $r['actor_id'] !== null ? (int)$r['actor_id'] : null,
                    'actor_name'  => $r['actor_name'],
                    'subject'     => $r['title'],
                    'url'         => '/sales/tasks?task=' . (int)$r['task_id'],
                    'at'          => $r['created_at'],
                ];
            }
        }

        // Merge the streams by time; the DB gave each one ordered already.
        usort($events, static fn(array $a, array $b) => [$b['at'], $b['key']] <=> [$a['at'], $a['key']]);
        $events = array_slice($events, 0, $limit);

        Response::success([
            'server_time' => SalesChallenge::serverTime(),
            'items'       => $events,
        ]);
    }

    /**
     * GET /admin/sales/notifications
     *
     * The things a salesperson should be told about right now: follow-ups that
     * are due or overdue, meetings starting shortly, and challenges that have
     * appeared, are about to expire, or have expired.
     *
     * Every item carries a stable `key` so the client can tell a genuinely new
     * alert from one it has already shown. All timing is decided here against
     * server time — the device clock is never consulted.
     */
    public function notifications(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.dashboard.view');
        SalesChallenge::sweepExpired();

        $scope    = SalesPermissions::leadScope($request->user);
        $tenantId = Database::tenantId();
        $userId   = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        $today    = date('Y-m-d');
        $items    = [];

        // ── Follow-ups: overdue, then due today ─────────────────────────────
        if (SalesPermissions::has($request->user, 'sales.followups.view')) {
            $params = [$tenantId, $today];
            $extra  = '';
            if ($scope['sql'] !== '') {
                $extra    = ' AND (l.assigned_to = ? OR f.assigned_to = ?)';
                $params[] = $userId;
                $params[] = $userId;
            }

            foreach (Database::fetchAll(
                "SELECT f.id, f.due_date, f.due_time, l.id AS lead_id, l.name AS lead_name, l.company
                   FROM sales_followups f
                   JOIN sales_leads l ON l.id = f.lead_id AND l.tenant_id = f.tenant_id
                  WHERE f.tenant_id = ? AND f.status = 'pending' AND f.due_date <= ?" . $extra . "
                  ORDER BY f.due_date ASC LIMIT 20",
                $params
            ) as $row) {
                $overdue = $row['due_date'] < $today;
                $items[] = [
                    'key'      => 'followup:' . $row['id'] . ':' . ($overdue ? 'overdue' : 'today'),
                    'type'     => $overdue ? 'followup_overdue' : 'followup_due',
                    'severity' => $overdue ? 'urgent' : 'normal',
                    'title'    => $overdue ? 'Overdue follow-up' : 'Follow-up due today',
                    'body'     => trim(($row['company'] ?: $row['lead_name'])
                                  . ($row['due_time'] ? ' — ' . substr((string)$row['due_time'], 0, 5) : '')),
                    'url'      => '/sales/leads/' . $row['lead_id'],
                    'at'       => $row['due_date'] . ' ' . ($row['due_time'] ?: '00:00:00'),
                ];
            }
        }

        // ── Meetings starting within the next 2 hours ───────────────────────
        if (SalesPermissions::has($request->user, 'sales.meetings.view')) {
            $params = [$tenantId, $today];
            $extra  = '';
            if ($scope['sql'] !== '') {
                $extra    = ' AND (l.assigned_to = ? OR m.assigned_to = ?)';
                $params[] = $userId;
                $params[] = $userId;
            }

            foreach (Database::fetchAll(
                "SELECT m.id, m.title, m.meeting_time, m.meeting_type, l.id AS lead_id, l.name AS lead_name, l.company
                   FROM sales_meetings m
                   JOIN sales_leads l ON l.id = m.lead_id AND l.tenant_id = m.tenant_id
                  WHERE m.tenant_id = ? AND m.status = 'scheduled' AND m.meeting_date = ?" . $extra . "
                    AND (m.meeting_time IS NULL
                         OR TIMESTAMP(m.meeting_date, m.meeting_time) BETWEEN NOW() AND NOW() + INTERVAL 2 HOUR)
                  ORDER BY m.meeting_time ASC LIMIT 10",
                $params
            ) as $row) {
                $items[] = [
                    'key'      => 'meeting:' . $row['id'],
                    'type'     => 'meeting_soon',
                    'severity' => 'normal',
                    'title'    => 'Meeting today',
                    'body'     => $row['title'] . ' — ' . ($row['company'] ?: $row['lead_name'])
                                  . ($row['meeting_time'] ? ' at ' . substr((string)$row['meeting_time'], 0, 5) : ''),
                    'url'      => '/sales/leads/' . $row['lead_id'],
                    'at'       => $today . ' ' . ($row['meeting_time'] ?: '00:00:00'),
                ];
            }
        }

        // ── Challenges: available to take, running out, or expired ──────────
        if (SalesPermissions::has($request->user, 'sales.challenges.view')) {
            $isManager = SalesPermissions::has($request->user, 'sales.challenges.manage');
            $offered   = "(c.accepted_by = ?
                           OR NOT EXISTS (SELECT 1 FROM sales_challenge_assignments a
                                           WHERE a.challenge_id = c.id AND a.tenant_id = c.tenant_id)
                           OR EXISTS (SELECT 1 FROM sales_challenge_assignments a
                                        WHERE a.challenge_id = c.id AND a.tenant_id = c.tenant_id AND a.user_id = ?))";

            $where  = 'c.tenant_id = ?';
            $params = [$tenantId];
            if (!$isManager) {
                $where   .= ' AND ' . $offered;
                $params[] = $userId;
                $params[] = $userId;
            }

            foreach (Database::fetchAll(
                "SELECT c.id, c.title, c.status, c.deadline, c.accepted_by,
                        TIMESTAMPDIFF(MINUTE, NOW(), c.deadline) AS minutes_left
                   FROM sales_challenges c
                  WHERE $where
                    AND (c.status = 'available'
                         OR (c.status IN ('accepted','in_progress') AND c.accepted_by = ?)
                         OR (c.status = 'expired' AND c.expired_at >= NOW() - INTERVAL 1 DAY))
                  ORDER BY c.deadline ASC LIMIT 15",
                [...$params, $userId]
            ) as $row) {
                $minutes = (int)$row['minutes_left'];

                if ($row['status'] === 'expired') {
                    $items[] = [
                        'key'      => 'challenge:' . $row['id'] . ':expired',
                        'type'     => 'challenge_expired',
                        'severity' => 'urgent',
                        'title'    => 'Challenge expired',
                        'body'     => $row['title'],
                        'url'      => '/sales/challenges/' . $row['id'],
                        'at'       => $row['deadline'],
                    ];
                } elseif ($row['status'] === 'available') {
                    $items[] = [
                        'key'      => 'challenge:' . $row['id'] . ':available',
                        'type'     => 'challenge_available',
                        'severity' => 'normal',
                        'title'    => 'New challenge available',
                        'body'     => $row['title'],
                        'url'      => '/sales/challenges/' . $row['id'],
                        'at'       => $row['deadline'],
                    ];
                } elseif ($minutes <= 60) {
                    // Only warn once it is genuinely close, or it becomes noise.
                    $items[] = [
                        'key'      => 'challenge:' . $row['id'] . ':ending',
                        'type'     => 'challenge_ending',
                        'severity' => 'urgent',
                        'title'    => 'Challenge deadline approaching',
                        'body'     => $row['title'] . ' — ' . max(0, $minutes) . ' min left',
                        'url'      => '/sales/challenges/' . $row['id'],
                        'at'       => $row['deadline'],
                    ];
                }
            }
        }

        // ── Tasks: what I owe, and what has come back to me ─────────────────
        if (SalesPermissions::has($request->user, 'sales.tasks.view')) {
            // Mine to do: due today or already late. A task with no date is not
            // an alert — it is a list item, and the list is one tap away.
            foreach (Database::fetchAll(
                "SELECT id, title, due_date, due_time, assigned_by_name
                   FROM sales_tasks
                  WHERE tenant_id = ? AND assigned_to = ? AND status IN ('open','in_progress')
                    AND due_date IS NOT NULL AND due_date <= ?
                  ORDER BY due_date ASC LIMIT 15",
                [$tenantId, $userId, $today]
            ) as $row) {
                $late    = $row['due_date'] < $today;
                $items[] = [
                    'key'      => 'task:' . $row['id'] . ':' . ($late ? 'overdue' : 'today'),
                    'type'     => $late ? 'task_overdue' : 'task_due',
                    'severity' => $late ? 'urgent' : 'normal',
                    'title'    => $late ? 'Task overdue' : 'Task due today',
                    'body'     => trim((string)$row['title']
                                  . ($row['assigned_by_name'] ? ' — from ' . $row['assigned_by_name'] : '')),
                    'url'      => '/sales/tasks?task=' . (int)$row['id'],
                    'at'       => $row['due_date'] . ' ' . ($row['due_time'] ?: '00:00:00'),
                ];
            }

            // Given out and finished: the assigner is told, and keeps being told
            // until they accept the work. That is the whole point of assigning
            // it to somebody — the loop has to close.
            foreach (Database::fetchAll(
                "SELECT t.id, t.title, t.completed_at, COALESCE(u.name, t.assigned_to_name) AS who
                   FROM sales_tasks t
                   LEFT JOIN users u ON u.user_id = t.assigned_to
                  WHERE t.tenant_id = ? AND t.assigned_by = ? AND t.status = 'completed'
                    AND t.reviewed_at IS NULL
                  ORDER BY t.completed_at DESC LIMIT 15",
                [$tenantId, $userId]
            ) as $row) {
                $items[] = [
                    'key'      => 'task:' . $row['id'] . ':completed',
                    'type'     => 'task_completed',
                    'severity' => 'normal',
                    'title'    => trim(($row['who'] ?: 'Someone') . ' completed a task you assigned'),
                    'body'     => (string)$row['title'],
                    'url'      => '/sales/tasks?task=' . (int)$row['id'],
                    'at'       => $row['completed_at'],
                ];
            }
        }

        // ── Challenges you set, finished by whoever took them ───────────────
        if (SalesPermissions::has($request->user, 'sales.challenges.view')) {
            foreach (Database::fetchAll(
                "SELECT c.id, c.title, c.completed_at, u.name AS who
                   FROM sales_challenges c
                   LEFT JOIN users u ON u.user_id = c.completed_by
                  WHERE c.tenant_id = ? AND c.created_by = ? AND c.status = 'completed'
                    AND c.completed_at >= NOW() - INTERVAL 3 DAY
                  ORDER BY c.completed_at DESC LIMIT 10",
                [$tenantId, $userId]
            ) as $row) {
                $items[] = [
                    'key'      => 'challenge:' . $row['id'] . ':completed',
                    'type'     => 'challenge_completed',
                    'severity' => 'normal',
                    'title'    => trim(($row['who'] ?: 'Someone') . ' completed your challenge'),
                    'body'     => (string)$row['title'],
                    'url'      => '/sales/challenges/' . (int)$row['id'],
                    'at'       => $row['completed_at'],
                ];
            }
        }

        // ── You were @mentioned ─────────────────────────────────────────────
        // Deliberately NOT filtered by lead scope: being named is the point of
        // a mention, and the thread it is in has already decided who may read
        // it. The URL is the record, so the mention lands you where the
        // conversation is rather than in a notification list.
        foreach (Database::fetchAll(
            "SELECT cm.id, cm.body, cm.author_name, cm.created_at, cm.entity_type, cm.entity_id,
                    cm.lead_id, cm.challenge_id, cm.task_id
               FROM sales_comment_mentions m
               JOIN sales_comments cm ON cm.id = m.comment_id AND cm.tenant_id = m.tenant_id
              WHERE m.tenant_id = ? AND m.user_id = ? AND cm.deleted_at IS NULL
                AND cm.created_at >= NOW() - INTERVAL 3 DAY
                AND (cm.author_id IS NULL OR cm.author_id <> ?)
              ORDER BY cm.created_at DESC LIMIT 15",
            [$tenantId, $userId, $userId]
        ) as $row) {
            $url = '/sales';
            if (!empty($row['challenge_id'])) {
                $url = '/sales/challenges/' . (int)$row['challenge_id'];
            } elseif (!empty($row['task_id'])) {
                $url = '/sales/tasks?task=' . (int)$row['task_id'];
            } elseif (!empty($row['lead_id'])) {
                $url = '/sales/leads/' . (int)$row['lead_id'];
            }
            $items[] = [
                'key'      => 'mention:' . $row['id'],
                'type'     => 'mention',
                'severity' => 'urgent',
                'title'    => trim(($row['author_name'] ?: 'Someone') . ' mentioned you'),
                'body'     => mb_substr((string)$row['body'], 0, 140),
                'url'      => $url,
                'at'       => $row['created_at'],
            ];
        }

        // ── Comments someone else left on something you can see ─────────────
        if (SalesPermissions::has($request->user, 'sales.comments.view')) {
            $where  = "cm.tenant_id = ? AND cm.deleted_at IS NULL
                       AND cm.created_at >= NOW() - INTERVAL 12 HOUR
                       AND (cm.author_id IS NULL OR cm.author_id <> ?)";
            $params = [$tenantId, $userId];
            if ($scope['sql'] !== '') {
                // Own leads, plus challenge threads (challenges are team-wide).
                $where   .= ' AND (l.assigned_to = ? OR cm.challenge_id IS NOT NULL)';
                $params[] = $userId;
            }

            foreach (Database::fetchAll(
                "SELECT cm.id, cm.body, cm.author_name, cm.created_at, cm.lead_id, cm.challenge_id,
                        l.name AS lead_name, l.company, ch.title AS challenge_title
                   FROM sales_comments cm
                   LEFT JOIN sales_leads l       ON l.id  = cm.lead_id      AND l.tenant_id  = cm.tenant_id
                   LEFT JOIN sales_challenges ch ON ch.id = cm.challenge_id AND ch.tenant_id = cm.tenant_id
                  WHERE $where
                  ORDER BY cm.created_at DESC LIMIT 10",
                $params
            ) as $row) {
                $on = $row['challenge_id']
                    ? (string)$row['challenge_title']
                    : (string)($row['company'] ?: $row['lead_name']);
                $items[] = [
                    'key'      => 'comment:' . $row['id'],
                    'type'     => 'comment_added',
                    'severity' => 'normal',
                    'title'    => trim(($row['author_name'] ?: 'Someone') . ' commented on ' . $on),
                    'body'     => mb_substr((string)$row['body'], 0, 140),
                    'url'      => $row['challenge_id']
                                  ? '/sales/challenges/' . (int)$row['challenge_id']
                                  : '/sales/leads/' . (int)$row['lead_id'],
                    'at'       => $row['created_at'],
                ];
            }
        }

        Response::success([
            'server_time' => SalesChallenge::serverTime(),
            'items'       => $items,
        ]);
    }
}
