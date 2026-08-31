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
}
