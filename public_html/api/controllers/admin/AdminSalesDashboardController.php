<?php
declare(strict_types=1);

/**
 * Sales Dashboard Controller — answers "what do I need to do today?".
 *
 *   GET /admin/sales/dashboard — today's/overdue/upcoming follow-ups, today's
 *                                and upcoming meetings, lead temperature
 *                                summary, active challenges
 *   GET /admin/sales/activity  — recent lead activity across the pipeline
 *
 * Everything is scoped to what the requesting user is allowed to see.
 */
class AdminSalesDashboardController
{
    public function index(Request $request): void
    {
        SalesPermissions::enforce($request->user, 'sales.dashboard.view');
        SalesChallenge::sweepExpired();

        $scope     = SalesPermissions::leadScope($request->user);
        $isManager = SalesPermissions::has($request->user, 'sales.challenges.manage');
        $tenantId  = Database::tenantId();

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

        $challengeCounts = SalesChallenge::counts($request->user, $isManager);

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
            'challenges' => [
                'counts' => $challengeCounts,
                'active' => SalesChallenge::all('in_progress', $request->user, $isManager, 1, 5)['rows'],
                'available' => SalesChallenge::all('available', $request->user, $isManager, 1, 5)['rows'],
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

        Response::success([
            'server_time' => SalesChallenge::serverTime(),
            'items'       => $items,
        ]);
    }
}
