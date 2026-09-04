<?php
declare(strict_types=1);

/**
 * Ops Client Controller
 * GET    /admin/ops/clients              — list
 * GET    /admin/ops/clients/{id}         — detail + timeline + payments + meetings + bugs
 * POST   /admin/ops/clients              — create
 * PUT    /admin/ops/clients/{id}         — update
 * POST   /admin/ops/clients/{id}/stage   — advance stage
 * DELETE /admin/ops/clients/{id}         — soft delete
 */
class AdminOpsClientController
{
    private const STAGES = [
        'First Meetup','Onboarding','Requirements','Scope Freeze',
        'Advance Paid','Development','QA','Delivery','Full Payment','Closed',
    ];

    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $stage    = $request->query('stage');
        $owner    = $request->query('owner');
        $health   = $request->query('health');
        $search   = $request->query('search');

        $sql    = "SELECT c.*, p.name AS project_name, p.id AS project_id,
                          p.balance AS balance_due, p.health AS project_health,
                          p.quoted AS project_quoted, p.received AS project_received,
                          p.payment_status AS project_payment_status
                   FROM ops_clients c
                   LEFT JOIN ops_projects p ON p.client_id = c.id AND p.tenant_id = c.tenant_id
                   WHERE c.tenant_id = ?";
        $params = [$tenantId];

        if ($stage)  { $sql .= ' AND c.stage = ?';  $params[] = $stage; }
        if ($owner)  { $sql .= ' AND c.owner = ?';  $params[] = $owner; }
        if ($health) { $sql .= ' AND c.health = ?'; $params[] = $health; }
        if ($search) {
            $sql .= ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
            $like = '%' . $search . '%';
            $params[] = $like; $params[] = $like; $params[] = $like;
        }

        $sql .= ' ORDER BY c.created_at DESC';
        $rows = Database::fetchAll($sql, $params);

        // Which of these clients came from a sales lead, in one query rather
        // than one per row — the loop below is already N+1 and does not need
        // help. Wrapped because the sales module is a separate schema file: a
        // database without it should still be able to list clients.
        $leadByClient = [];
        $clientIds = array_map(static fn($r) => (int)$r['id'], $rows);
        if ($clientIds) {
            try {
                $in = implode(',', array_fill(0, count($clientIds), '?'));
                foreach (Database::fetchAll(
                    "SELECT converted_client_id, MIN(id) AS lead_id
                       FROM sales_leads
                      WHERE tenant_id = ? AND converted_client_id IN ($in)
                      GROUP BY converted_client_id",
                    [$tenantId, ...$clientIds]
                ) as $r) {
                    $leadByClient[(int)$r['converted_client_id']] = (int)$r['lead_id'];
                }
            } catch (\Throwable $e) {
                error_log('[OpsClient] sales lead lookup unavailable: ' . $e->getMessage());
            }
        }

        // Compute days since last contact from activity log
        $result = array_map(function($row) use ($tenantId, $leadByClient) {
            $last = Database::fetch(
                "SELECT created_at FROM ops_activity_log
                 WHERE tenant_id = ? AND entity_type = 'client' AND entity_id = ?
                 ORDER BY created_at DESC LIMIT 1",
                [$tenantId, $row['id']]
            );
            $daysSince = $last
                ? (int) round((time() - strtotime($last['created_at'])) / 86400)
                : null;

            $nextFollowup = Database::fetch(
                "SELECT next_followup FROM ops_meetings
                 WHERE tenant_id = ? AND client_id = ? AND next_followup >= CURDATE()
                 ORDER BY next_followup ASC LIMIT 1",
                [$tenantId, $row['id']]
            );

            return array_merge($this->format($row), [
                'days_since_contact' => $daysSince,
                'next_followup'      => $nextFollowup ? $nextFollowup['next_followup'] : null,
                'sales_lead_id'      => $leadByClient[(int)$row['id']] ?? null,
            ]);
        }, $rows);

        Response::success($result);
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $client = Database::fetch(
            'SELECT * FROM ops_clients WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$client) Response::error('Client not found', 404);

        $project = Database::fetch(
            'SELECT * FROM ops_projects WHERE client_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 1',
            [$id, $tenantId]
        );

        $stageHistory = Database::fetchAll(
            'SELECT * FROM ops_project_stages WHERE project_id = ? AND tenant_id = ? ORDER BY completed_at ASC',
            [$project ? $project['id'] : 0, $tenantId]
        );

        $timeline = Database::fetchAll(
            "SELECT a.*, GROUP_CONCAT(c.comment SEPARATOR '|||') AS comments
             FROM ops_activity_log a
             LEFT JOIN ops_activity_comments c ON c.activity_id = a.id AND c.tenant_id = a.tenant_id
             WHERE a.tenant_id = ? AND a.entity_type IN ('client','project')
               AND (a.entity_id = ? OR a.entity_id = ?)
             GROUP BY a.id
             ORDER BY a.created_at DESC",
            [$tenantId, $id, $project ? $project['id'] : 0]
        );

        $payments = Database::fetchAll(
            'SELECT * FROM ops_payments WHERE tenant_id = ? AND client_id = ? ORDER BY payment_date DESC',
            [$tenantId, $id]
        );

        $meetings = Database::fetchAll(
            'SELECT * FROM ops_meetings WHERE tenant_id = ? AND client_id = ? ORDER BY date DESC',
            [$tenantId, $id]
        );

        $bugs = Database::fetchAll(
            "SELECT b.* FROM ops_bugs b
             JOIN ops_projects p ON p.id = b.project_id
             WHERE b.tenant_id = ? AND p.client_id = ? AND b.status NOT IN ('closed','wont_fix')
             ORDER BY b.created_at DESC LIMIT 20",
            [$tenantId, $id]
        );

        $checklist = Database::fetchAll(
            'SELECT * FROM ops_document_checklist WHERE tenant_id = ? AND client_id = ? ORDER BY id ASC',
            [$tenantId, $id]
        );

        // Seed default checklist items if none exist
        if (empty($checklist)) {
            $defaults = [
                'Requirement document sent','Scope freeze document signed',
                'Quotation sent','Advance invoice sent','Onboarding email sent',
                'Training video sent','Final invoice sent','AMC agreement signed',
            ];
            foreach ($defaults as $item) {
                Database::insert('ops_document_checklist', [
                    'tenant_id' => $tenantId,
                    'client_id' => $id,
                    'item_name' => $item,
                    'is_done'   => 0,
                ]);
            }
            $checklist = Database::fetchAll(
                'SELECT * FROM ops_document_checklist WHERE tenant_id = ? AND client_id = ? ORDER BY id ASC',
                [$tenantId, $id]
            );
        }

        [$salesLead, $followups] = $this->salesFollowups($id, $tenantId);

        $data = $this->format($client);
        $data['project']       = $project ? $this->formatProject($project) : null;
        $data['stage_history'] = $stageHistory;
        $data['timeline']      = $timeline;
        $data['payments']      = $payments;
        $data['meetings']      = $meetings;
        $data['bugs']          = $bugs;
        $data['checklist']     = $checklist;
        $data['sales_lead']    = $salesLead;
        $data['followups']     = $followups;

        Response::success($data);
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $name = trim((string)($body['name'] ?? ''));
        if (!$name) Response::error('Name is required', 422);

        $id = Database::insert('ops_clients', [
            'tenant_id'       => $tenantId,
            'name'            => $name,
            'phone'           => trim((string)($body['phone'] ?? '')),
            'email'           => strtolower(trim((string)($body['email'] ?? ''))),
            'source'          => trim((string)($body['source'] ?? '')),
            'source_pitch_id' => !empty($body['source_pitch_id']) ? (int)$body['source_pitch_id'] : null,
            'owner'           => trim((string)($body['owner'] ?? '')),
            'health'          => in_array($body['health'] ?? '', ['green','yellow','red']) ? $body['health'] : 'green',
            'stage'           => 'First Meetup',
            'notes'           => trim((string)($body['notes'] ?? '')),
            // Carried across when a lead is converted, so what the sales team
            // learned about the client does not stop at the handover.
            'current_software' => trim((string)($body['current_software'] ?? '')),
            'switch_reason'    => trim((string)($body['switch_reason'] ?? '')),
        ]);

        $this->logActivity($tenantId, 'client', $id, 'created', 'Client created', $body['owner'] ?? '');

        $row = Database::fetch('SELECT * FROM ops_clients WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $client = Database::fetch(
            'SELECT * FROM ops_clients WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$client) Response::error('Client not found', 404);

        $updates = [];
        foreach (['name','phone','email','source','owner','notes','current_software','switch_reason'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        if (isset($body['source_pitch_id'])) $updates['source_pitch_id'] = !empty($body['source_pitch_id']) ? (int)$body['source_pitch_id'] : null;
        if (isset($body['health']) && in_array($body['health'], ['green','yellow','red'])) $updates['health'] = $body['health'];

        if (!empty($updates)) {
            Database::update('ops_clients', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
            $this->logActivity($tenantId, 'client', $id, 'updated', 'Client details updated', $body['updated_by'] ?? '');
        }

        $row = Database::fetch('SELECT * FROM ops_clients WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row));
    }

    public function advanceStage(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $client = Database::fetch(
            'SELECT * FROM ops_clients WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$client) Response::error('Client not found', 404);

        $newStage = trim((string)($body['stage'] ?? ''));
        if (!in_array($newStage, self::STAGES)) {
            Response::error('Invalid stage', 422);
        }

        $doneBy = trim((string)($body['done_by'] ?? ''));
        $notes  = trim((string)($body['notes']   ?? ''));

        Database::update('ops_clients', ['stage' => $newStage], ['id' => $id, 'tenant_id' => $tenantId]);

        // Update project stage too
        $project = Database::fetch(
            'SELECT id FROM ops_projects WHERE client_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1',
            [$id, $tenantId]
        );
        if ($project) {
            Database::update('ops_projects', ['stage' => $newStage], ['id' => $project['id'], 'tenant_id' => $tenantId]);
            Database::insert('ops_project_stages', [
                'tenant_id'    => $tenantId,
                'project_id'   => $project['id'],
                'stage_name'   => $newStage,
                'completed_by' => $doneBy,
                'notes'        => $notes,
            ]);

            // If Advance Paid → increment pitch conversion
            if ($newStage === 'Advance Paid' && $client['source_pitch_id']) {
                $this->incrementPitchConversion($tenantId, (int)$client['source_pitch_id']);
            }
        }

        $desc = "Stage advanced to {$newStage}" . ($notes ? " — {$notes}" : '');
        $this->logActivity($tenantId, 'client', $id, 'stage_changed', $desc, $doneBy);

        $row = Database::fetch('SELECT * FROM ops_clients WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row));
    }

    public function checklistUpdate(Request $request): void
    {
        $id       = (int) $request->param('id');
        $itemId   = (int) $request->param('item_id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $item = Database::fetch(
            'SELECT * FROM ops_document_checklist WHERE id = ? AND client_id = ? AND tenant_id = ? LIMIT 1',
            [$itemId, $id, $tenantId]
        );
        if (!$item) Response::error('Checklist item not found', 404);

        $updates = ['is_done' => (int)(bool)($body['is_done'] ?? false)];
        if ($updates['is_done']) {
            $updates['completed_date'] = date('Y-m-d');
            $updates['completed_by']   = trim((string)($body['completed_by'] ?? ''));
        } else {
            // Clear completion data when unticking
            $updates['completed_date'] = null;
            $updates['completed_by']   = null;
        }
        Database::update('ops_document_checklist', $updates, ['id' => $itemId]);

        Response::success(['updated' => true]);
    }

    public function checklistFiles(Request $request): void
    {
        $id       = (int) $request->param('id');
        $itemId   = (int) $request->param('item_id');
        $tenantId = Database::tenantId();

        Database::fetch(
            'SELECT id FROM ops_document_checklist WHERE id = ? AND client_id = ? AND tenant_id = ? LIMIT 1',
            [$itemId, $id, $tenantId]
        ) ?: Response::error('Checklist item not found', 404);

        $files = Database::fetchAll(
            'SELECT * FROM ops_document_checklist_files WHERE checklist_id = ? AND tenant_id = ? ORDER BY version_no DESC',
            [$itemId, $tenantId]
        );
        Response::success($files);
    }

    public function checklistUpload(Request $request): void
    {
        $id       = (int) $request->param('id');
        $itemId   = (int) $request->param('item_id');
        $tenantId = Database::tenantId();

        Database::fetch(
            'SELECT id FROM ops_document_checklist WHERE id = ? AND client_id = ? AND tenant_id = ? LIMIT 1',
            [$itemId, $id, $tenantId]
        ) ?: Response::error('Checklist item not found', 404);

        if (empty($_FILES['file'])) Response::error('No file uploaded', 422);

        $file     = $_FILES['file'];
        $origName = basename($file['name']);
        $ext      = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowed  = ['pdf','doc','docx','xls','xlsx','png','jpg','jpeg','txt'];
        if (!in_array($ext, $allowed)) Response::error('File type not allowed', 422);

        $stored = FileStore::put($file['tmp_name'], "checklist/{$tenantId}/{$itemId}", $origName);

        $maxVer = Database::fetch(
            'SELECT COALESCE(MAX(version_no),0)+1 AS v FROM ops_document_checklist_files WHERE checklist_id = ? AND tenant_id = ?',
            [$itemId, $tenantId]
        );

        $uploadedBy = trim((string)($_POST['uploaded_by'] ?? ''));
        $fileId = Database::insert('ops_document_checklist_files', [
            'tenant_id'    => $tenantId,
            'checklist_id' => $itemId,
            'file_path'    => $stored,
            'file_name'    => $origName,
            'version_no'   => (int)$maxVer['v'],
            'uploaded_by'  => $uploadedBy,
        ]);

        $row = Database::fetch('SELECT * FROM ops_document_checklist_files WHERE id = ? LIMIT 1', [$fileId]);
        Response::success($row, 'File uploaded', 201);
    }

    public function checklistDeleteFile(Request $request): void
    {
        $id       = (int) $request->param('id');
        $itemId   = (int) $request->param('item_id');
        $fileId   = (int) $request->param('file_id');
        $tenantId = Database::tenantId();

        $file = Database::fetch(
            'SELECT * FROM ops_document_checklist_files WHERE id = ? AND checklist_id = ? AND tenant_id = ? LIMIT 1',
            [$fileId, $itemId, $tenantId]
        );
        if (!$file) Response::error('File not found', 404);

        Database::query(
            'DELETE FROM ops_document_checklist_files WHERE id = ? AND tenant_id = ?',
            [$fileId, $tenantId]
        );

        Response::success(['deleted' => true]);
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_clients WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId])
            ?: Response::error('Client not found', 404);
        Database::update('ops_clients', ['stage' => 'Closed'], ['id' => $id, 'tenant_id' => $tenantId]);
        Response::success(['message' => 'Client closed']);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private function incrementPitchConversion(int $tenantId, int $pitchId): void
    {
        // Pitch conversion is derived, not stored — no action needed.
        // The count is computed dynamically in the pitches controller.
    }

    private function logActivity(int $tenantId, string $type, int $entityId, string $action, string $desc, string $doneBy): void
    {
        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => $type,
            'entity_id'   => $entityId,
            'action'      => $action,
            'description' => $desc,
            'done_by'     => $doneBy,
        ]);
    }

    /**
     * The lead this client was converted from, and its sales follow-ups.
     *
     * Follow-ups belong to a lead, not to a client — so the way back is
     * sales_leads.converted_client_id, and a client keyed in directly on the
     * CRM side has no lead and therefore nothing to show. That is a normal
     * state, not an error: the caller gets a null lead and an empty list, and
     * the page offers nothing rather than an explanation nobody asked for.
     *
     * Wrapped because the sales module is a separate schema file. A database
     * that has not imported it should still be able to open a client, so a
     * missing table costs this one section and not the whole page.
     *
     * @return array{0: ?array<string,mixed>, 1: list<array<string,mixed>>}
     */
    private function salesFollowups(int $clientId, int $tenantId): array
    {
        try {
            $lead = Database::fetch(
                'SELECT id, lead_code, name, company, status, assigned_to
                   FROM sales_leads
                  WHERE converted_client_id = ? AND tenant_id = ?
                  ORDER BY id ASC LIMIT 1',
                [$clientId, $tenantId]
            );
            if (!$lead) {
                return [null, []];
            }

            // Pending first and soonest-first inside that, because the only
            // question this section answers is "what is still owed to this
            // client, and when". Completed ones stay underneath as the record
            // of what was already done, newest first.
            $followups = Database::fetchAll(
                "SELECT f.id, f.due_date, f.due_time, f.purpose, f.status, f.outcome,
                        f.outcome_notes, f.completed_at, f.assigned_to,
                        u.name AS assigned_to_name
                   FROM sales_followups f
                   LEFT JOIN users u ON u.user_id = f.assigned_to
                  WHERE f.tenant_id = ? AND f.lead_id = ? AND f.status <> 'cancelled'
                  ORDER BY f.status = 'pending' DESC,
                           IF(f.status = 'pending', f.due_date, '9999-12-31') ASC,
                           f.due_date DESC
                  LIMIT 25",
                [$tenantId, (int)$lead['id']]
            );

            return [
                [
                    'id'          => (int)$lead['id'],
                    'lead_code'   => $lead['lead_code'],
                    'name'        => $lead['name'],
                    'company'     => $lead['company'],
                    'status'      => $lead['status'],
                    'assigned_to' => $lead['assigned_to'] !== null ? (int)$lead['assigned_to'] : null,
                ],
                $followups,
            ];
        } catch (\Throwable $e) {
            error_log('[OpsClient] sales follow-ups unavailable: ' . $e->getMessage());
            return [null, []];
        }
    }

    private function format(array $row): array
    {
        return [
            'id'              => (int)$row['id'],
            'name'            => $row['name'],
            'phone'           => $row['phone'],
            'email'           => $row['email'],
            'source'          => $row['source'],
            'source_pitch_id' => $row['source_pitch_id'] ? (int)$row['source_pitch_id'] : null,
            'owner'           => $row['owner'],
            'health'          => $row['health'],
            'stage'           => $row['stage'],
            'notes'           => $row['notes'],
            'current_software' => $row['current_software'] ?? '',
            'switch_reason'    => $row['switch_reason'] ?? '',
            'project_name'    => $row['project_name'] ?? null,
            'project_id'      => isset($row['project_id']) ? (int)$row['project_id'] : null,
            'balance_due'     => isset($row['balance_due']) ? (float)$row['balance_due'] : null,
            // The money, from the project. Null (not 0) when a client has no
            // project yet — "nothing quoted" and "quoted nothing" are different
            // facts, and a screen showing ₹0 for the first is simply wrong.
            'quoted'          => isset($row['project_quoted'])   ? (float)$row['project_quoted']   : null,
            'received'        => isset($row['project_received']) ? (float)$row['project_received'] : null,
            'payment_status'  => $row['project_payment_status'] ?? null,
            'days_since_contact' => $row['days_since_contact'] ?? null,
            'next_followup'   => $row['next_followup'] ?? null,
            'created_at'      => $row['created_at'],
        ];
    }

    private function formatProject(array $row): array
    {
        return [
            'id'             => (int)$row['id'],
            'name'           => $row['name'],
            'stage'          => $row['stage'],
            'owner'          => $row['owner'],
            'health'         => $row['health'],
            'priority'       => $row['priority'],
            'quoted'         => (float)$row['quoted'],
            'received'       => (float)$row['received'],
            'balance'        => (float)$row['balance'],
            'payment_status' => $row['payment_status'],
            'deadline'       => $row['deadline'],
            'start_date'     => $row['start_date'],
            'current_work'   => $row['current_work'],
            'next_action'    => $row['next_action'],
            'blocker'        => $row['blocker'],
        ];
    }
}
