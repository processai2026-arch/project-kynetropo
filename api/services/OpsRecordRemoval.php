<?php
declare(strict_types=1);

/**
 * Permanently removes an ops client or project and everything that hangs off it.
 *
 * Used by DELETE /admin/ops/clients/{id}, DELETE /admin/ops/projects/{id} and
 * database/legacy/remove_lead_clients.php, so all three remove exactly the same
 * rows. Everything runs in one transaction: a client is either gone completely
 * or not touched at all.
 *
 * What goes: the projects, their stages, notes, credentials, bugs (with
 * screenshots and comments), payments, AMC records, meetings (with follow-ups
 * and files), the client's document checklist (with files), calls and
 * follow-ups booked on the client, and the ops timeline of each record.
 * Payments leave Finance with them.
 *
 * What stays: expenses tagged to a deleted project keep their amount and lose
 * the tag (the money was still spent). A sales lead that was converted into the
 * client goes back to being a lead (status 'onboarding', unlinked) — the same
 * state "undo conversion" leaves it in.
 */
class OpsRecordRemoval
{
    /**
     * @return array{client: string, projects: int, payments: int}
     */
    public static function deleteClient(int $tenantId, int $clientId): array
    {
        $client = Database::fetch(
            'SELECT id, name FROM ops_clients WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$clientId, $tenantId]
        );
        if (!$client) {
            throw new AppException('Client not found', 404);
        }
        $projectIds = array_map(
            static fn(array $r): int => (int)$r['id'],
            Database::fetchAll('SELECT id FROM ops_projects WHERE client_id = ? AND tenant_id = ?', [$clientId, $tenantId])
        );

        Database::beginTransaction();
        try {
            $payments = self::removeProjects($tenantId, $projectIds);
            // Payments, meetings and AMC rows keyed on the client but not on one of its projects.
            $payments += self::run('DELETE FROM ops_payments WHERE tenant_id = ? AND client_id = ?', [$tenantId, $clientId]);
            self::removeMeetings($tenantId, 'client_id = ?', [$clientId]);
            self::run('DELETE FROM ops_amc_records WHERE tenant_id = ? AND client_id = ?', [$tenantId, $clientId]);

            self::run(
                'DELETE f FROM ops_document_checklist_files f
                   JOIN ops_document_checklist d ON d.id = f.checklist_id AND d.tenant_id = f.tenant_id
                  WHERE d.tenant_id = ? AND d.client_id = ?',
                [$tenantId, $clientId]
            );
            self::run('DELETE FROM ops_document_checklist WHERE tenant_id = ? AND client_id = ?', [$tenantId, $clientId]);

            // Calls and follow-ups booked on the customer itself (never on a lead: exactly one of the two is set).
            self::run('DELETE FROM sales_followups WHERE tenant_id = ? AND client_id = ?', [$tenantId, $clientId]);
            self::run('DELETE FROM sales_calls WHERE tenant_id = ? AND client_id = ?', [$tenantId, $clientId]);
            self::run(
                "UPDATE sales_leads
                    SET status = 'onboarding', converted_client_id = NULL,
                        converted_project_id = NULL, converted_at = NULL
                  WHERE tenant_id = ? AND converted_client_id = ?",
                [$tenantId, $clientId]
            );

            self::removeTimeline($tenantId, 'client', [$clientId]);
            self::run('DELETE FROM ops_clients WHERE id = ? AND tenant_id = ?', [$clientId, $tenantId]);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            throw $e;
        }

        return ['client' => (string)$client['name'], 'projects' => count($projectIds), 'payments' => $payments];
    }

    /**
     * @return array{project: string, payments: int}
     */
    public static function deleteProject(int $tenantId, int $projectId): array
    {
        $project = Database::fetch(
            'SELECT id, name FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$projectId, $tenantId]
        );
        if (!$project) {
            throw new AppException('Project not found', 404);
        }

        Database::beginTransaction();
        try {
            $payments = self::removeProjects($tenantId, [$projectId]);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            throw $e;
        }

        return ['project' => (string)$project['name'], 'payments' => $payments];
    }

    /** Removes the given projects and their children. Returns how many payments went with them. */
    private static function removeProjects(int $tenantId, array $projectIds): int
    {
        if (!$projectIds) {
            return 0;
        }
        $in     = implode(',', array_fill(0, count($projectIds), '?'));
        $params = [$tenantId, ...$projectIds];

        foreach (['ops_bug_screenshots', 'ops_bug_comments'] as $child) {
            self::run(
                "DELETE x FROM $child x
                   JOIN ops_bugs b ON b.id = x.bug_id AND b.tenant_id = x.tenant_id
                  WHERE b.tenant_id = ? AND b.project_id IN ($in)",
                $params
            );
        }
        foreach (['ops_bugs', 'ops_project_stages', 'ops_project_notes', 'ops_project_credentials', 'ops_amc_records'] as $table) {
            self::run("DELETE FROM $table WHERE tenant_id = ? AND project_id IN ($in)", $params);
        }
        $payments = self::run("DELETE FROM ops_payments WHERE tenant_id = ? AND project_id IN ($in)", $params);
        self::removeMeetings($tenantId, "project_id IN ($in)", $projectIds);
        self::run("UPDATE ops_expenses SET project_id = NULL WHERE tenant_id = ? AND project_id IN ($in)", $params);
        self::run("UPDATE sales_leads SET converted_project_id = NULL WHERE tenant_id = ? AND converted_project_id IN ($in)", $params);

        self::removeTimeline($tenantId, 'project', $projectIds);
        self::run("DELETE FROM ops_projects WHERE tenant_id = ? AND id IN ($in)", $params);
        return $payments;
    }

    /** Meetings matching $where (a condition on ops_meetings), with their follow-ups and files. */
    private static function removeMeetings(int $tenantId, string $where, array $whereParams): void
    {
        $meetingIds = array_map(
            static fn(array $r): int => (int)$r['id'],
            self::rows("SELECT id FROM ops_meetings WHERE tenant_id = ? AND $where", [$tenantId, ...$whereParams])
        );
        if (!$meetingIds) {
            return;
        }
        $in     = implode(',', array_fill(0, count($meetingIds), '?'));
        $params = [$tenantId, ...$meetingIds];

        $followupIds = array_map(
            static fn(array $r): int => (int)$r['id'],
            self::rows("SELECT id FROM ops_meeting_followups WHERE tenant_id = ? AND meeting_id IN ($in)", $params)
        );
        self::run("DELETE FROM ops_meeting_files WHERE tenant_id = ? AND entity_type = 'meeting' AND entity_id IN ($in)", $params);
        if ($followupIds) {
            $fin = implode(',', array_fill(0, count($followupIds), '?'));
            self::run("DELETE FROM ops_meeting_files WHERE tenant_id = ? AND entity_type = 'followup' AND entity_id IN ($fin)", [$tenantId, ...$followupIds]);
        }
        self::run("DELETE FROM ops_meeting_followups WHERE tenant_id = ? AND meeting_id IN ($in)", $params);
        self::run("DELETE FROM ops_meetings WHERE tenant_id = ? AND id IN ($in)", $params);
    }

    private static function removeTimeline(int $tenantId, string $entityType, array $ids): void
    {
        $in     = implode(',', array_fill(0, count($ids), '?'));
        $params = [$tenantId, $entityType, ...$ids];
        self::run(
            "DELETE c FROM ops_activity_comments c
               JOIN ops_activity_log a ON a.id = c.activity_id AND a.tenant_id = c.tenant_id
              WHERE a.tenant_id = ? AND a.entity_type = ? AND a.entity_id IN ($in)",
            $params
        );
        self::run("DELETE FROM ops_activity_log WHERE tenant_id = ? AND entity_type = ? AND entity_id IN ($in)", $params);
    }

    /**
     * Runs one statement. A table or column this database never had (an optional
     * module's schema that was not imported) holds nothing to remove, so that one
     * error is skipped; anything else aborts the whole removal.
     */
    private static function run(string $sql, array $params): int
    {
        try {
            return Database::execute($sql, $params);
        } catch (PDOException $e) {
            if (self::isMissingSchema($e)) return 0;
            throw $e;
        }
    }

    private static function rows(string $sql, array $params): array
    {
        try {
            return Database::fetchAll($sql, $params);
        } catch (PDOException $e) {
            if (self::isMissingSchema($e)) return [];
            throw $e;
        }
    }

    private static function isMissingSchema(PDOException $e): bool
    {
        // 1146 = table doesn't exist, 1054 = unknown column
        return in_array((int)($e->errorInfo[1] ?? 0), [1146, 1054], true);
    }
}
