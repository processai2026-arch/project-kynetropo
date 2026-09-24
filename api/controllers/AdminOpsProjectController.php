<?php
declare(strict_types=1);

/**
 * Ops Project Controller
 * GET    /admin/ops/projects             — list
 * GET    /admin/ops/projects/{id}        — detail
 * POST   /admin/ops/projects             — create
 * PUT    /admin/ops/projects/{id}        — update
 * DELETE /admin/ops/projects/{id}        — delete with its payments, bugs, meetings (OpsRecordRemoval)
 */
class AdminOpsProjectController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $stage    = $request->query('stage');
        $owner    = $request->query('owner');
        $health   = $request->query('health');
        $priority = $request->query('priority');
        $search   = $request->query('search');

        $sql    = "SELECT p.*, c.name AS client_name, c.client_code
                   FROM ops_projects p
                   JOIN ops_clients c ON c.id = p.client_id AND c.tenant_id = p.tenant_id
                   WHERE p.tenant_id = ?";
        $params = [$tenantId];

        if ($stage)    { $sql .= ' AND p.stage = ?';    $params[] = $stage; }
        if ($owner)    { $sql .= ' AND p.owner = ?';    $params[] = $owner; }
        if ($health)   { $sql .= ' AND p.health = ?';   $params[] = $health; }
        if ($priority) { $sql .= ' AND p.priority = ?'; $params[] = $priority; }
        if ($search) {
            $sql .= ' AND (p.name LIKE ? OR c.name LIKE ? OR p.project_code LIKE ? OR c.client_code LIKE ?)';
            $like = '%' . $search . '%';
            array_push($params, $like, $like, $like, $like);
        }

        // Oldest first: the order the Project IDs were handed out in.
        $sql .= ' ORDER BY p.created_at ASC, p.id ASC';
        $rows = Database::fetchAll($sql, $params);
        Response::success(array_map([$this, 'format'], $rows));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $project = Database::fetch(
            "SELECT p.*, c.name AS client_name, c.client_code, c.phone AS client_phone
             FROM ops_projects p
             JOIN ops_clients c ON c.id = p.client_id AND c.tenant_id = p.tenant_id
             WHERE p.id = ? AND p.tenant_id = ? LIMIT 1",
            [$id, $tenantId]
        );
        if (!$project) Response::error('Project not found', 404);

        $stageHistory = Database::fetchAll(
            'SELECT * FROM ops_project_stages WHERE project_id = ? AND tenant_id = ? ORDER BY completed_at ASC',
            [$id, $tenantId]
        );

        $bugs = Database::fetchAll(
            'SELECT * FROM ops_bugs WHERE project_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 50',
            [$id, $tenantId]
        );

        $meetings = Database::fetchAll(
            'SELECT * FROM ops_meetings WHERE project_id = ? AND tenant_id = ? ORDER BY date DESC LIMIT 20',
            [$id, $tenantId]
        );

        $payments = Database::fetchAll(
            'SELECT * FROM ops_payments WHERE project_id = ? AND tenant_id = ? ORDER BY payment_date DESC',
            [$id, $tenantId]
        );

        $activityLog = Database::fetchAll(
            "SELECT * FROM ops_activity_log
             WHERE tenant_id = ? AND entity_type = 'project' AND entity_id = ?
             ORDER BY created_at DESC LIMIT 50",
            [$tenantId, $id]
        );

        $notes = Database::fetchAll(
            "SELECT * FROM ops_project_notes WHERE project_id = ? AND tenant_id = ? ORDER BY saved_at DESC",
            [$id, $tenantId]
        );

        $data = $this->format($project);
        $data['stage_history'] = $stageHistory;
        $data['bugs']          = $bugs;
        $data['meetings']      = $meetings;
        $data['payments']      = $payments;
        $data['activity_log']  = $activityLog;
        $data['notes']         = $notes;

        Response::success($data);
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $name     = trim((string)($body['name']      ?? ''));
        $clientId = (int)($body['client_id'] ?? 0);

        if (!$name)     Response::error('Name is required', 422);
        if (!$clientId) Response::error('Client is required', 422);

        $client = Database::fetch(
            'SELECT id FROM ops_clients WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$clientId, $tenantId]
        );
        if (!$client) Response::error('Client not found', 404);

        try {
            $code = trim((string)($body['project_code'] ?? '')) !== ''
                ? OpsCodes::accept($tenantId, OpsCodes::PROJECT, $body['project_code'])
                : OpsCodes::next($tenantId, OpsCodes::PROJECT);
        } catch (AppException $e) {
            Response::error($e->getMessage(), $e->getCode());
        }

        $quoted = (float)($body['quoted'] ?? 0);
        $id = Database::insert('ops_projects', [
            'tenant_id'                => $tenantId,
            'project_code'             => $code,
            'client_id'                => $clientId,
            'name'                     => $name,
            'stage'                    => 'Lead',
            'owner'                    => trim((string)($body['owner'] ?? '')),
            'start_date'               => $body['start_date'] ?? null,
            'deadline'                 => $body['deadline']   ?? null,
            'health'                   => in_array($body['health'] ?? '', ['green','yellow','red']) ? $body['health'] : 'green',
            'priority'                 => in_array($body['priority'] ?? '', ['low','medium','high','critical']) ? $body['priority'] : 'medium',
            'quoted'                   => $quoted,
            'received'                 => 0,
            'balance'                  => $quoted,
            'payment_status'           => 'pending',
            'next_collection_trigger'  => trim((string)($body['next_collection_trigger'] ?? '')),
            'collection_target_date'   => $body['collection_target_date'] ?? null,
            'current_work'             => trim((string)($body['current_work'] ?? '')),
            'next_action'              => trim((string)($body['next_action']  ?? '')),
            'next_deadline'            => $body['next_deadline'] ?? null,
            'founder_note'             => trim((string)($body['founder_note'] ?? '')),
            'blocker'                  => trim((string)($body['blocker'] ?? '')),
        ]);

        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'project',
            'entity_id'   => $id,
            'action'      => 'created',
            'description' => "Project '{$name}' created",
            'done_by'     => $body['owner'] ?? '',
        ]);

        $row = Database::fetch(
            "SELECT p.*, c.name AS client_name, c.client_code FROM ops_projects p
             JOIN ops_clients c ON c.id = p.client_id
             WHERE p.id = ? LIMIT 1",
            [$id]
        );
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $project = Database::fetch(
            'SELECT * FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$project) Response::error('Project not found', 404);

        $updates = [];
        foreach (['name','owner','stage','current_work','next_action','founder_note','blocker','next_collection_trigger'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        foreach (['start_date','deadline','next_deadline','collection_target_date','current_work_due','next_action_due'] as $f) {
            if (array_key_exists($f, $body)) $updates[$f] = $body[$f] ?: null;
        }
        $recalcFinance = isset($body['quoted']) || isset($body['received']);
        if ($recalcFinance) {
            $newQuoted   = isset($body['quoted'])   ? (float)$body['quoted']   : (float)$project['quoted'];
            $newReceived = isset($body['received'])  ? (float)$body['received'] : (float)$project['received'];
            $newBalance  = $newQuoted - $newReceived;
            if (isset($body['quoted']))   $updates['quoted']   = $newQuoted;
            if (isset($body['received'])) $updates['received'] = $newReceived;
            $updates['balance'] = $newBalance;
            // Only recalculate payment_status when not explicitly set by caller.
            if (!isset($body['payment_status'])) {
                if ($newBalance <= 0) {
                    $updates['payment_status'] = 'paid';
                } elseif ($newReceived > 0) {
                    $updates['payment_status'] = 'partial';
                } else {
                    $updates['payment_status'] = 'pending';
                }
            }
        }
        if (isset($body['health'])   && in_array($body['health'],   ['green','yellow','red']))                   $updates['health']   = $body['health'];
        if (isset($body['priority']) && in_array($body['priority'], ['low','medium','high','critical']))         $updates['priority'] = $body['priority'];
        if (isset($body['payment_status']) && in_array($body['payment_status'], ['pending','partial','paid','overdue'])) $updates['payment_status'] = $body['payment_status'];
        if (array_key_exists('project_code', $body) && strtoupper(trim((string)$body['project_code'])) !== (string)($project['project_code'] ?? '')) {
            try {
                $updates['project_code'] = OpsCodes::accept($tenantId, OpsCodes::PROJECT, $body['project_code'], $id);
            } catch (AppException $e) {
                Response::error($e->getMessage(), $e->getCode());
            }
        }
        if (isset($body['client_id']) && (int)$body['client_id'] !== (int)$project['client_id']) {
            Database::fetch('SELECT id FROM ops_clients WHERE id = ? AND tenant_id = ? LIMIT 1', [(int)$body['client_id'], $tenantId])
                ?: Response::error('Client not found', 404);
            $updates['client_id'] = (int)$body['client_id'];
        }

        if (!empty($updates)) {
            // Snapshot current_work / next_action before overwriting
            $savedBy = trim((string)($body['updated_by'] ?? ''));
            if (isset($updates['current_work']) && trim((string)$project['current_work']) !== '' && trim((string)$updates['current_work']) !== trim((string)$project['current_work'])) {
                Database::insert('ops_project_notes', [
                    'tenant_id'  => $tenantId,
                    'project_id' => $id,
                    'field'      => 'current_work',
                    'note'       => trim((string)$project['current_work']),
                    'due_date'   => $project['current_work_due'] ?: null,
                    'saved_by'   => $savedBy,
                ]);
            }
            if (isset($updates['next_action']) && trim((string)$project['next_action']) !== '' && trim((string)$updates['next_action']) !== trim((string)$project['next_action'])) {
                Database::insert('ops_project_notes', [
                    'tenant_id'  => $tenantId,
                    'project_id' => $id,
                    'field'      => 'next_action',
                    'note'       => trim((string)$project['next_action']),
                    'due_date'   => $project['next_action_due'] ?: null,
                    'saved_by'   => $savedBy,
                ]);
            }

            Database::update('ops_projects', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
            // A stage move goes on the project's stage history, with the note the mover left.
            if (isset($updates['stage']) && $updates['stage'] !== (string)$project['stage']) {
                Database::insert('ops_project_stages', [
                    'tenant_id'    => $tenantId,
                    'project_id'   => $id,
                    'stage_name'   => $updates['stage'],
                    'completed_by' => $savedBy,
                    'notes'        => trim((string)($body['stage_note'] ?? '')),
                ]);
            }
            // Moved to another client: its money moves with it, so Finance credits the right customer.
            if (isset($updates['client_id'])) {
                foreach (['ops_payments', 'ops_amc_records'] as $table) {
                    Database::execute("UPDATE $table SET client_id = ? WHERE project_id = ? AND tenant_id = ?", [$updates['client_id'], $id, $tenantId]);
                }
            }

            // Build human-readable activity description from what actually changed
            $parts = [];
            $fieldLabels = [
                'project_code'     => 'Project ID',
                'client_id'        => 'Client',
                'name'             => 'Name',
                'owner'            => 'Owner',
                'stage'            => 'Stage',
                'health'           => 'Health',
                'priority'         => 'Priority',
                'current_work'     => 'Current Work',
                'next_action'      => 'Next Action',
                'founder_note'     => 'Founder Note',
                'blocker'          => 'Blocker',
                'quoted'           => 'Quoted',
                'received'         => 'Received',
                'payment_status'   => 'Payment Status',
                'deadline'         => 'Deadline',
                'next_deadline'    => 'Next Deadline',
                'current_work_due' => 'Current Work Due',
                'next_action_due'  => 'Next Action Due',
                'next_collection_trigger' => 'Next Collection Trigger',
                'collection_target_date'  => 'Collection Target Date',
            ];
            foreach ($updates as $field => $newVal) {
                if ($field === 'client_id') { $parts[] = 'Moved to another client'; continue; }
                $label = $fieldLabels[$field] ?? $field;
                $oldVal = trim((string)($project[$field] ?? ''));
                $newStr = trim((string)$newVal);
                if ($newStr === '' && $oldVal === '') continue;
                if ($newStr === $oldVal) continue;
                if ($newStr === '') {
                    $parts[] = "$label cleared";
                } else {
                    $parts[] = "$label: $newStr";
                }
            }
            $description = count($parts) > 0
                ? implode(' | ', $parts)
                : 'Project details updated';

            Database::insert('ops_activity_log', [
                'tenant_id'   => $tenantId,
                'entity_type' => 'project',
                'entity_id'   => $id,
                'action'      => 'updated',
                'description' => $description,
                'done_by'     => $savedBy,
            ]);
        }

        $row = Database::fetch(
            "SELECT p.*, c.name AS client_name, c.client_code FROM ops_projects p
             JOIN ops_clients c ON c.id = p.client_id
             WHERE p.id = ? LIMIT 1",
            [$id]
        );
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        try {
            $removed = OpsRecordRemoval::deleteProject($tenantId, $id);
        } catch (AppException $e) {
            Response::error($e->getMessage(), $e->getCode());
        }
        Response::success($removed, 'Project deleted');
    }

    private function format(array $row): array
    {
        return [
            'id'                       => (int)$row['id'],
            'project_code'             => $row['project_code'] ?? null,
            'client_id'                => (int)$row['client_id'],
            'client_code'              => $row['client_code'] ?? null,
            'client_name'              => $row['client_name'] ?? null,
            'name'                     => $row['name'],
            'stage'                    => $row['stage'],
            'owner'                    => $row['owner'],
            'start_date'               => $row['start_date'],
            'deadline'                 => $row['deadline'],
            'health'                   => $row['health'],
            'priority'                 => $row['priority'],
            'quoted'                   => (float)$row['quoted'],
            'received'                 => (float)$row['received'],
            'balance'                  => (float)$row['balance'],
            'payment_status'           => $row['payment_status'],
            'next_collection_trigger'  => $row['next_collection_trigger'],
            'collection_target_date'   => $row['collection_target_date'],
            'current_work'             => $row['current_work'],
            'current_work_due'         => $row['current_work_due'],
            'next_action'              => $row['next_action'],
            'next_action_due'          => $row['next_action_due'],
            'next_deadline'            => $row['next_deadline'],
            'founder_note'             => $row['founder_note'],
            'blocker'                  => $row['blocker'],
            'created_at'               => $row['created_at'],
            'updated_at'               => $row['updated_at'],
        ];
    }
}
