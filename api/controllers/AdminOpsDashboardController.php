<?php
declare(strict_types=1);

/**
 * Ops Dashboard Controller
 * GET /admin/ops/dashboard-stats  the numbers; answers straight away
 * GET /admin/ops/dashboard-ai     AI recommendations, loaded by the page separately
 */
class AdminOpsDashboardController
{
    public function stats(Request $request): void
    {
        $tenantId = Database::tenantId();
        $today    = date('Y-m-d');
        $month    = date('Y-m');

        // Today's actions
        $followupsToday = $this->followupsToday($tenantId, $today);

        // AMC money due by the end of this month, overdue included: the renewal
        // of a paid (or free) year, or a charged year not paid yet.
        $amcDueThisMonth = Database::fetchAll(
            "SELECT a.*, c.name AS client_name, p.name AS project_name,
                    IF(a.term_paid, a.renewal_date, a.start_date) AS due_date
             FROM ops_amc_records a
             JOIN ops_clients c ON c.id = a.client_id
             JOIN ops_projects p ON p.id = a.project_id
             WHERE a.tenant_id = ? AND IF(a.term_paid, a.renewal_date, a.start_date) <= LAST_DAY(CURDATE())
             ORDER BY due_date",
            [$tenantId]
        );

        $meetingsToday = Database::fetchAll(
            "SELECT m.*, c.name AS client_name
             FROM ops_meetings m
             LEFT JOIN ops_clients c ON c.id = m.client_id
             WHERE m.tenant_id = ? AND DATE(m.date) = ?",
            [$tenantId, $today]
        );

        $paymentsExpectedToday = Database::fetchAll(
            "SELECT p.*, c.name AS client_name, proj.name AS project_name
             FROM ops_projects p
             JOIN ops_clients c ON c.id = p.client_id
             JOIN ops_projects proj ON proj.id = p.id
             WHERE p.tenant_id = ? AND p.collection_target_date = ? AND p.payment_status != 'paid'",
            [$tenantId, $today]
        );

        // Money overview
        $moneyRow = Database::fetch(
            "SELECT
               COALESCE(SUM(quoted), 0)   AS total_quoted,
               COALESCE(SUM(received), 0) AS total_received,
               COALESCE(SUM(balance), 0)  AS total_balance
             FROM ops_projects WHERE tenant_id = ?",
            [$tenantId]
        );

        $thisMonthCollected = Database::fetch(
            "SELECT COALESCE(SUM(amount), 0) AS amount
             FROM ops_payments WHERE tenant_id = ? AND DATE_FORMAT(payment_date,'%Y-%m') = ?",
            [$tenantId, $month]
        );

        $overdueCollections = $this->overdueCollections($tenantId, $today);

        // Project health
        $healthCounts = Database::fetchAll(
            "SELECT health, COUNT(*) AS cnt FROM ops_projects WHERE tenant_id = ? GROUP BY health",
            [$tenantId]
        );
        $health = ['red' => 0, 'yellow' => 0, 'green' => 0];
        foreach ($healthCounts as $h) $health[$h['health']] = (int)$h['cnt'];

        $redYellowProjects = $this->atRiskProjects($tenantId);

        // Lead pipeline summary
        $pipelineByStage = Database::fetchAll(
            "SELECT stage, COUNT(*) AS cnt FROM ops_clients WHERE tenant_id = ? GROUP BY stage",
            [$tenantId]
        );

        $overdueFollowups = Database::fetch(
            "SELECT COUNT(DISTINCT m.client_id) AS cnt
             FROM ops_meetings m
             WHERE m.tenant_id = ? AND m.next_followup < ? AND m.next_followup IS NOT NULL",
            [$tenantId, $today]
        );

        $proposalsSent = Database::fetch(
            "SELECT COUNT(*) AS cnt FROM ops_clients
             WHERE tenant_id = ? AND stage IN ('Scope Freeze','Requirements')",
            [$tenantId]
        );

        // Due comments today (bug comments with due_date = today)
        $dueCommentsToday = Database::fetchAll(
            "SELECT bc.id, bc.comment, bc.added_by, bc.due_date,
                    b.id AS bug_id, b.description AS bug_description,
                    p.id AS project_id, p.name AS project_name,
                    'bug' AS entity_type
             FROM ops_bug_comments bc
             JOIN ops_bugs b ON b.id = bc.bug_id AND b.tenant_id = bc.tenant_id
             JOIN ops_projects p ON p.id = b.project_id
             WHERE bc.tenant_id = ? AND bc.due_date = ?
             ORDER BY bc.created_at ASC",
            [$tenantId, $today]
        );

        // Project action notes due today (current_work_due or next_action_due = today)
        $projectActionsDueToday = Database::fetchAll(
            "SELECT p.id AS project_id, p.name AS project_name,
                    p.current_work, p.current_work_due,
                    p.next_action, p.next_action_due,
                    c.name AS client_name, c.id AS client_id
             FROM ops_projects p
             JOIN ops_clients c ON c.id = p.client_id
             WHERE p.tenant_id = ?
               AND (p.current_work_due = ? OR p.next_action_due = ?)
               AND p.stage NOT IN ('Closed','Delivered')
             ORDER BY p.health DESC",
            [$tenantId, $today, $today]
        );

        // Upcoming tasks: due in the next 2 days (not today — today is covered above)
        $twoDaysOut = date('Y-m-d', strtotime('+2 days'));
        $tomorrow   = date('Y-m-d', strtotime('+1 day'));

        $upcomingBugs = Database::fetchAll(
            "SELECT b.id, b.description, b.priority, b.status, b.target_date,
                    p.id AS project_id, p.name AS project_name
             FROM ops_bugs b
             JOIN ops_projects p ON p.id = b.project_id
             WHERE b.tenant_id = ?
               AND b.target_date BETWEEN ? AND ?
               AND b.status NOT IN ('closed','wont_fix')
             ORDER BY b.target_date ASC, FIELD(b.priority,'p0_critical','p1_high','p2_medium','p3_low')",
            [$tenantId, $tomorrow, $twoDaysOut]
        );

        $upcomingProjectActions = Database::fetchAll(
            "SELECT p.id AS project_id, p.name AS project_name,
                    p.current_work, p.current_work_due,
                    p.next_action, p.next_action_due,
                    c.name AS client_name
             FROM ops_projects p
             JOIN ops_clients c ON c.id = p.client_id
             WHERE p.tenant_id = ?
               AND (
                 (p.current_work_due BETWEEN ? AND ?)
                 OR (p.next_action_due BETWEEN ? AND ?)
               )
               AND p.stage NOT IN ('Closed','Delivered')
             ORDER BY LEAST(COALESCE(p.current_work_due,'9999-12-31'), COALESCE(p.next_action_due,'9999-12-31')) ASC",
            [$tenantId, $tomorrow, $twoDaysOut, $tomorrow, $twoDaysOut]
        );

        Response::success([
            'today_actions' => [
                'followups_today'           => $followupsToday,
                'amc_due_this_month'        => $amcDueThisMonth,
                'meetings_today'            => $meetingsToday,
                'payments_expected_today'   => $paymentsExpectedToday,
                'due_comments_today'        => $dueCommentsToday,
                'project_actions_due_today' => $projectActionsDueToday,
            ],
            'upcoming_tasks' => [
                'bugs'            => $upcomingBugs,
                'project_actions' => $upcomingProjectActions,
                'window_end'      => $twoDaysOut,
            ],
            'money' => [
                'total_quoted'          => (float)($moneyRow['total_quoted'] ?? 0),
                'total_received'        => (float)($moneyRow['total_received'] ?? 0),
                'total_balance'         => (float)($moneyRow['total_balance'] ?? 0),
                'this_month_collected'  => (float)($thisMonthCollected['amount'] ?? 0),
                'overdue_collections'   => $overdueCollections,
            ],
            'project_health' => [
                'red'    => $health['red'],
                'yellow' => $health['yellow'],
                'green'  => $health['green'],
                'at_risk_projects' => array_map(function($p) {
                    return [
                        'id'          => (int)$p['id'],
                        'name'        => $p['name'],
                        'client_name' => $p['client_name'],
                        'health'      => $p['health'],
                        'stage'       => $p['stage'],
                        'next_action' => $p['next_action'],
                    ];
                }, $redYellowProjects),
            ],
            'pipeline' => [
                'by_stage'          => $pipelineByStage,
                'overdue_followups' => (int)($overdueFollowups['cnt'] ?? 0),
                'proposals_sent'    => (int)($proposalsSent['cnt'] ?? 0),
            ],
        ]);
    }

    /**
     * GET /admin/ops/dashboard-ai
     *
     * The recommendations used to be part of dashboard-stats, which made every
     * dashboard load wait about a second for Groq. They come separately now,
     * and a reply is reused for an hour while the snapshot it was based on is
     * unchanged, so most loads do not call Groq at all.
     */
    public function ai(Request $request): void
    {
        $tenantId = Database::tenantId();
        $today    = date('Y-m-d');
        $context  = $this->buildAiContext(
            $tenantId, $today,
            $this->overdueCollections($tenantId, $today),
            $this->atRiskProjects($tenantId),
            $this->followupsToday($tenantId, $today)
        );

        $cacheFile = self::cacheDir() . '/ops-ai-' . $tenantId . '-' . md5($context) . '.json';
        if (is_file($cacheFile) && filemtime($cacheFile) > time() - self::AI_CACHE_TTL) {
            $cached = json_decode((string)file_get_contents($cacheFile), true);
            if (is_array($cached)) {
                Response::success(['recommendations' => $cached, 'cached' => true]);
                return;
            }
        }

        try {
            $recommendations = $this->getAiRecommendations($context);
        } catch (\Throwable $e) {
            error_log('[OpsDashboard] AI error: ' . $e->getMessage());
            Response::success(['recommendations' => ['AI insights temporarily unavailable.'], 'cached' => false]);
            return;
        }

        if ($recommendations) {
            foreach (glob(self::cacheDir() . '/ops-ai-' . $tenantId . '-*.json') ?: [] as $old) @unlink($old);
            @file_put_contents($cacheFile, json_encode($recommendations), LOCK_EX);
        }
        Response::success(['recommendations' => $recommendations, 'cached' => false]);
    }

    /** How long an AI reply is reused while the snapshot behind it is unchanged. */
    private const AI_CACHE_TTL = 3600;

    /** api/storage/cache: not shipped by releases, created on first use, denied to the web. */
    private static function cacheDir(): string
    {
        $dir = ROOT_PATH . '/storage/cache';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        return $dir;
    }

    private function followupsToday(int $tenantId, string $today): array
    {
        return Database::fetchAll(
            "SELECT m.next_followup, c.name AS client_name, c.id AS client_id
             FROM ops_meetings m
             JOIN ops_clients c ON c.id = m.client_id AND c.tenant_id = m.tenant_id
             WHERE m.tenant_id = ? AND m.next_followup = ?
             GROUP BY c.id",
            [$tenantId, $today]
        );
    }

    private function overdueCollections(int $tenantId, string $today): array
    {
        return Database::fetchAll(
            "SELECT p.*, c.name AS client_name
             FROM ops_projects p
             JOIN ops_clients c ON c.id = p.client_id
             WHERE p.tenant_id = ? AND p.collection_target_date < ? AND p.payment_status NOT IN ('paid') AND p.balance > 0",
            [$tenantId, $today]
        );
    }

    private function atRiskProjects(int $tenantId): array
    {
        return Database::fetchAll(
            "SELECT p.*, c.name AS client_name
             FROM ops_projects p
             JOIN ops_clients c ON c.id = p.client_id
             WHERE p.tenant_id = ? AND p.health IN ('red','yellow') AND p.stage NOT IN ('Closed','Delivered')
             ORDER BY FIELD(p.health,'red','yellow'), p.updated_at ASC LIMIT 10",
            [$tenantId]
        );
    }

    private function buildAiContext(int $tenantId, string $today, array $overdue, array $atRisk, array $followups): string
    {
        $lines = ["Today: {$today}"];
        $lines[] = "Overdue collections: " . count($overdue);
        foreach ($overdue as $o) {
            $lines[] = "  - {$o['client_name']}: ₹" . number_format((float)$o['balance']) . " overdue since {$o['collection_target_date']}";
        }
        $lines[] = "At-risk projects: " . count($atRisk);
        foreach ($atRisk as $p) {
            $lines[] = "  - [{$p['health']}] {$p['name']} ({$p['client_name']}) — stage: {$p['stage']}";
        }
        $lines[] = "Follow-ups due today: " . count($followups);
        foreach ($followups as $f) {
            $lines[] = "  - {$f['client_name']}";
        }

        // Bug counts
        $bugStats = Database::fetch(
            "SELECT COUNT(*) AS total,
             SUM(status='open') AS open_bugs,
             SUM(developer_id IS NULL) AS unassigned
             FROM ops_bugs WHERE tenant_id = ? AND status NOT IN ('closed','wont_fix')",
            [$tenantId]
        );
        $lines[] = "Active bugs: {$bugStats['total']} total, {$bugStats['open_bugs']} open, {$bugStats['unassigned']} unassigned";

        return implode("\n", $lines);
    }

    private function getAiRecommendations(string $context): array
    {
        $prompt = "You are an executive assistant for a software agency. Based on this daily snapshot, give 4-6 short, actionable recommendations. Each on a new line starting with a bullet. Be specific with names and numbers.\n\n{$context}";
        $reply  = GroqClient::chat([
            ['role' => 'system', 'content' => 'You are a concise operations advisor. Reply with bullet points only. No markdown headers.'],
            ['role' => 'user',   'content' => $prompt],
        ], 400);
        return array_values(array_filter(array_map('trim', explode("\n", $reply))));
    }
}
