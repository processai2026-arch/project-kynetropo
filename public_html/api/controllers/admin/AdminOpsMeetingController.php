<?php
declare(strict_types=1);

/**
 * Ops Meetings Controller
 * GET    /admin/ops/meetings            — list
 * GET    /admin/ops/meetings/{id}       — detail
 * POST   /admin/ops/meetings            — create
 * PUT    /admin/ops/meetings/{id}       — update (add outcome)
 * DELETE /admin/ops/meetings/{id}       — delete
 */
class AdminOpsMeetingController
{
    public function index(Request $request): void
    {
        $tenantId  = Database::tenantId();
        $clientId  = $request->query('client_id');
        $projectId = $request->query('project_id');
        $dateFrom  = $request->query('date_from');
        $dateTo    = $request->query('date_to');

        $sql    = "SELECT m.*, c.name AS client_name, p.name AS project_name
                   FROM ops_meetings m
                   LEFT JOIN ops_clients  c ON c.id = m.client_id  AND c.tenant_id = m.tenant_id
                   LEFT JOIN ops_projects p ON p.id = m.project_id AND p.tenant_id = m.tenant_id
                   WHERE m.tenant_id = ?";
        $params = [$tenantId];

        if ($clientId)  { $sql .= ' AND m.client_id = ?';      $params[] = (int)$clientId; }
        if ($projectId) { $sql .= ' AND m.project_id = ?';     $params[] = (int)$projectId; }
        if ($dateFrom)  { $sql .= ' AND DATE(m.date) >= ?';    $params[] = $dateFrom; }
        if ($dateTo)    { $sql .= ' AND DATE(m.date) <= ?';    $params[] = $dateTo; }

        $sql .= ' ORDER BY m.date DESC';
        $rows = Database::fetchAll($sql, $params);
        Response::success(array_map([$this, 'format'], $rows));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $row      = Database::fetch(
            "SELECT m.*, c.name AS client_name, p.name AS project_name
             FROM ops_meetings m
             LEFT JOIN ops_clients  c ON c.id = m.client_id
             LEFT JOIN ops_projects p ON p.id = m.project_id
             WHERE m.id = ? AND m.tenant_id = ? LIMIT 1",
            [$id, $tenantId]
        );
        if (!$row) Response::error('Meeting not found', 404);
        Response::success($this->format($row));
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();
        $date     = trim((string)($body['date'] ?? ''));

        if (!$date) Response::error('Date is required', 422);

        $clientId  = !empty($body['client_id'])  ? (int)$body['client_id']  : null;
        $projectId = !empty($body['project_id']) ? (int)$body['project_id'] : null;

        // Auto-fill project from client if not specified
        if ($clientId && !$projectId) {
            $p = Database::fetch(
                'SELECT id FROM ops_projects WHERE client_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1',
                [$clientId, $tenantId]
            );
            if ($p) $projectId = (int)$p['id'];
        }

        $id = Database::insert('ops_meetings', [
            'tenant_id'     => $tenantId,
            'client_id'     => $clientId,
            'project_id'    => $projectId,
            'date'          => $date,
            'type'          => in_array($body['type'] ?? '', ['google_meet','in_person','phone_call','whatsapp_call']) ? $body['type'] : 'google_meet',
            'link'          => trim((string)($body['link']       ?? '')) ?: null,
            'attendees'     => trim((string)($body['attendees']  ?? '')),
            'agenda'        => trim((string)($body['agenda']     ?? '')),
            'outcome'       => trim((string)($body['outcome']    ?? '')),
            'next_action'   => trim((string)($body['next_action'] ?? '')),
            'next_followup' => $body['next_followup'] ?? null,
            'booked_by'     => trim((string)($body['booked_by'] ?? '')),
        ]);

        // Log to client activity timeline
        if ($clientId) {
            Database::insert('ops_activity_log', [
                'tenant_id'   => $tenantId,
                'entity_type' => 'client',
                'entity_id'   => $clientId,
                'action'      => 'meeting_scheduled',
                'description' => 'Meeting scheduled for ' . date('d M Y', strtotime($date)),
                'done_by'     => $body['booked_by'] ?? '',
            ]);
        }

        $row = Database::fetch(
            "SELECT m.*, c.name AS client_name, p.name AS project_name
             FROM ops_meetings m
             LEFT JOIN ops_clients c ON c.id = m.client_id
             LEFT JOIN ops_projects p ON p.id = m.project_id
             WHERE m.id = ? LIMIT 1",
            [$id]
        );
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $meeting = Database::fetch(
            'SELECT * FROM ops_meetings WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$meeting) Response::error('Meeting not found', 404);

        $updates = [];
        foreach (['date','type','link','attendees','agenda','outcome','next_action','booked_by'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]) ?: null;
        }
        if (array_key_exists('next_followup', $body)) $updates['next_followup'] = $body['next_followup'] ?: null;

        if (!empty($updates)) {
            Database::update('ops_meetings', $updates, ['id' => $id, 'tenant_id' => $tenantId]);

            // If outcome was just added, log to client activity timeline
            if (isset($updates['outcome']) && $updates['outcome'] && !$meeting['outcome']) {
                if ($meeting['client_id']) {
                    Database::insert('ops_activity_log', [
                        'tenant_id'   => $tenantId,
                        'entity_type' => 'client',
                        'entity_id'   => (int)$meeting['client_id'],
                        'action'      => 'meeting_outcome',
                        'description' => 'Meeting outcome: ' . mb_substr($updates['outcome'], 0, 100),
                        'done_by'     => $body['updated_by'] ?? '',
                    ]);
                }
            }
        }

        $row = Database::fetch(
            "SELECT m.*, c.name AS client_name, p.name AS project_name
             FROM ops_meetings m
             LEFT JOIN ops_clients c ON c.id = m.client_id
             LEFT JOIN ops_projects p ON p.id = m.project_id
             WHERE m.id = ? LIMIT 1",
            [$id]
        );
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_meetings WHERE id = ? AND tenant_id = ?', [$id, $tenantId])
            ?: Response::error('Meeting not found', 404);
        Database::query('DELETE FROM ops_meetings WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(['message' => 'Meeting deleted']);
    }

    private function format(array $row): array
    {
        return [
            'id'            => (int)$row['id'],
            'client_id'     => $row['client_id'] ? (int)$row['client_id'] : null,
            'client_name'   => $row['client_name'] ?? null,
            'project_id'    => $row['project_id'] ? (int)$row['project_id'] : null,
            'project_name'  => $row['project_name'] ?? null,
            'date'          => $row['date'],
            'type'          => $row['type'],
            'link'          => $row['link'],
            'attendees'     => $row['attendees'],
            'agenda'        => $row['agenda'],
            'outcome'       => $row['outcome'],
            'next_action'   => $row['next_action'],
            'next_followup' => $row['next_followup'],
            'booked_by'     => $row['booked_by'],
            'created_at'    => $row['created_at'],
        ];
    }

    // ── Meeting / followup file uploads ──────────────────────────────────────

    public function listMeetingFiles(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_meetings WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId])
            ?: Response::error('Meeting not found', 404);
        $files = Database::fetchAll(
            "SELECT * FROM ops_meeting_files WHERE tenant_id = ? AND entity_type = 'meeting' AND entity_id = ? ORDER BY created_at DESC",
            [$tenantId, $id]
        );
        Response::success($files);
    }

    public function uploadMeetingFile(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_meetings WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId])
            ?: Response::error('Meeting not found', 404);
        $this->handleFileUpload($tenantId, 'meeting', $id);
    }

    public function deleteMeetingFile(Request $request): void
    {
        $fileId   = (int) $request->param('file_id');
        $tenantId = Database::tenantId();
        $this->handleFileDelete($tenantId, $fileId);
    }

    public function listFollowupFiles(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_meeting_followups WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId])
            ?: Response::error('Follow-up not found', 404);
        $files = Database::fetchAll(
            "SELECT * FROM ops_meeting_files WHERE tenant_id = ? AND entity_type = 'followup' AND entity_id = ? ORDER BY created_at DESC",
            [$tenantId, $id]
        );
        Response::success($files);
    }

    public function uploadFollowupFile(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_meeting_followups WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId])
            ?: Response::error('Follow-up not found', 404);
        $this->handleFileUpload($tenantId, 'followup', $id);
    }

    public function deleteFollowupFile(Request $request): void
    {
        $fileId   = (int) $request->param('file_id');
        $tenantId = Database::tenantId();
        $this->handleFileDelete($tenantId, $fileId);
    }

    private function handleFileUpload(int $tenantId, string $entityType, int $entityId): void
    {
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::error('File upload failed or no file provided', 422);
        }

        $file     = $_FILES['file'];
        $origName = basename($file['name']);
        $ext      = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $mime     = $file['type'] ?? '';

        $voiceExts = ['mp3','mp4','m4a','ogg','wav','webm','aac','opus'];
        $docExts   = ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','png','jpg','jpeg'];
        if (!in_array($ext, array_merge($voiceExts, $docExts))) {
            Response::error('File type not allowed', 422);
        }
        $fileType = in_array($ext, $voiceExts) ? 'voice' : 'document';

        $stored = FileStore::put($file['tmp_name'], "meetings/{$tenantId}/{$entityType}/{$entityId}", $origName);

        $uploadedBy = trim((string)($_POST['uploaded_by'] ?? ''));
        $fileId = Database::insert('ops_meeting_files', [
            'tenant_id'   => $tenantId,
            'entity_type' => $entityType,
            'entity_id'   => $entityId,
            'file_name'   => $origName,
            'file_path'   => $stored,
            'file_type'   => $fileType,
            'mime_type'   => $mime ?: null,
            'uploaded_by' => $uploadedBy,
        ]);

        $row = Database::fetch('SELECT * FROM ops_meeting_files WHERE id = ? LIMIT 1', [$fileId]);
        Response::success($row, 'File uploaded', 201);
    }

    private function handleFileDelete(int $tenantId, int $fileId): void
    {
        $file = Database::fetch(
            'SELECT * FROM ops_meeting_files WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$fileId, $tenantId]
        );
        if (!$file) Response::error('File not found', 404);

        // Delete physical file
        $fullPath = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/') . '/' . ltrim($file['file_path'], '/');
        if (file_exists($fullPath)) @unlink($fullPath);

        Database::query('DELETE FROM ops_meeting_files WHERE id = ? AND tenant_id = ?', [$fileId, $tenantId]);
        Response::success(['deleted' => true]);
    }
}
