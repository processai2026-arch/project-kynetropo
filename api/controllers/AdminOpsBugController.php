<?php
declare(strict_types=1);

/**
 * Ops Bug Tracker Controller
 * GET    /admin/ops/bugs               — list (filter by project_id)
 * GET    /admin/ops/bugs/{id}          — detail with screenshots + comments
 * POST   /admin/ops/bugs               — create
 * PUT    /admin/ops/bugs/{id}          — update
 * POST   /admin/ops/bugs/{id}/comments — add comment
 * DELETE /admin/ops/bugs/{id}          — delete
 */
class AdminOpsBugController
{
    public function index(Request $request): void
    {
        $tenantId  = Database::tenantId();
        $projectId = (int)($request->query('project_id') ?? 0);
        $status    = $request->query('status');
        $priority  = $request->query('priority');
        $reporter  = $request->query('reported_by');

        $sql    = "SELECT b.*, p.name AS project_name,
                          CONCAT(e1.name) AS developer_name,
                          CONCAT(e2.name) AS qa_name
                   FROM ops_bugs b
                   JOIN ops_projects p ON p.id = b.project_id
                   LEFT JOIN ops_employees e1 ON e1.id = b.developer_id AND e1.tenant_id = b.tenant_id
                   LEFT JOIN ops_employees e2 ON e2.id = b.qa_id         AND e2.tenant_id = b.tenant_id
                   WHERE b.tenant_id = ?";
        $params = [$tenantId];

        if ($projectId) { $sql .= ' AND b.project_id = ?'; $params[] = $projectId; }
        if ($status)    { $sql .= ' AND b.status = ?';     $params[] = $status; }
        if ($priority)  { $sql .= ' AND b.priority = ?';   $params[] = $priority; }
        if ($reporter)  { $sql .= ' AND b.reported_by = ?'; $params[] = $reporter; }

        $sql .= " ORDER BY FIELD(b.priority,'p0_critical','p1_high','p2_medium','p3_low'), b.created_at DESC";
        $rows = Database::fetchAll($sql, $params);
        Response::success(array_map([$this, 'format'], $rows));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $bug = Database::fetch(
            "SELECT b.*, p.name AS project_name,
                    e1.name AS developer_name, e2.name AS qa_name
             FROM ops_bugs b
             JOIN ops_projects p ON p.id = b.project_id
             LEFT JOIN ops_employees e1 ON e1.id = b.developer_id
             LEFT JOIN ops_employees e2 ON e2.id = b.qa_id
             WHERE b.id = ? AND b.tenant_id = ? LIMIT 1",
            [$id, $tenantId]
        );
        if (!$bug) Response::error('Bug not found', 404);

        $screenshots = Database::fetchAll(
            'SELECT * FROM ops_bug_screenshots WHERE bug_id = ? AND tenant_id = ? ORDER BY created_at ASC',
            [$id, $tenantId]
        );
        $comments = Database::fetchAll(
            'SELECT * FROM ops_bug_comments WHERE bug_id = ? AND tenant_id = ? ORDER BY created_at ASC',
            [$id, $tenantId]
        );
        $history = Database::fetchAll(
            "SELECT * FROM ops_activity_log WHERE tenant_id = ? AND entity_type = 'bug' AND entity_id = ? ORDER BY created_at ASC",
            [$tenantId, $id]
        );

        $data = $this->format($bug);
        $data['screenshots'] = $screenshots;
        $data['comments']    = $comments;
        $data['history']     = $history;
        Response::success($data);
    }

    public function store(Request $request): void
    {
        $body      = $request->body();
        $tenantId  = Database::tenantId();
        $projectId = (int)($body['project_id'] ?? 0);
        $desc      = trim((string)($body['description'] ?? ''));

        if (!$projectId) Response::error('Project is required', 422);
        if (!$desc)      Response::error('Description is required', 422);

        $project = Database::fetch(
            'SELECT id FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$projectId, $tenantId]
        );
        if (!$project) Response::error('Project not found', 404);

        $id = Database::insert('ops_bugs', [
            'tenant_id'      => $tenantId,
            'project_id'     => $projectId,
            'module'         => trim((string)($body['module']       ?? '')),
            'description'    => $desc,
            'type'           => in_array($body['type'] ?? '', ['bug','feature_request','change_request']) ? $body['type'] : 'bug',
            'priority'       => in_array($body['priority'] ?? '', ['p0_critical','p1_high','p2_medium','p3_low']) ? $body['priority'] : 'p2_medium',
            'reported_by'    => trim((string)($body['reported_by']  ?? '')),
            'reported_date'  => !empty($body['reported_date']) ? $body['reported_date'] : null,
            'developer_id'   => !empty($body['developer_id']) ? (int)$body['developer_id'] : null,
            'qa_id'          => !empty($body['qa_id'])         ? (int)$body['qa_id']        : null,
            'status'         => 'open',
            'target_date'    => $body['target_date'] ?? null,
            'steps_to_repro' => trim((string)($body['steps_to_repro'] ?? '')),
            'parent_bug_id'  => !empty($body['parent_bug_id']) ? (int)$body['parent_bug_id'] : null,
        ]);

        $reportedDateStr = !empty($body['reported_date']) ? " (reported: {$body['reported_date']})" : '';
        $targetDateStr   = !empty($body['target_date'])   ? ", resolve by: {$body['target_date']}" : '';

        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'bug',
            'entity_id'   => $id,
            'action'      => 'created',
            'description' => 'Bug reported: ' . mb_substr($desc, 0, 80) . $reportedDateStr . $targetDateStr,
            'done_by'     => $body['reported_by'] ?? '',
        ]);

        // Also log on project timeline
        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'project',
            'entity_id'   => $projectId,
            'action'      => 'bug_added',
            'description' => 'Bug reported: ' . mb_substr($desc, 0, 80) . $reportedDateStr . $targetDateStr,
            'done_by'     => $body['reported_by'] ?? '',
        ]);

        $row = Database::fetch('SELECT * FROM ops_bugs WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $bug = Database::fetch(
            'SELECT * FROM ops_bugs WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$bug) Response::error('Bug not found', 404);

        $updates = [];
        foreach (['module','description','type','reported_by','steps_to_repro'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        if (isset($body['priority']) && in_array($body['priority'], ['p0_critical','p1_high','p2_medium','p3_low'])) {
            $updates['priority'] = $body['priority'];
        }
        if (isset($body['status']) && in_array($body['status'], ['open','in_progress','fixed','retest','closed','wont_fix'])) {
            $updates['status'] = $body['status'];
        }
        if (isset($body['developer_id'])) $updates['developer_id'] = !empty($body['developer_id']) ? (int)$body['developer_id'] : null;
        if (isset($body['qa_id']))        $updates['qa_id']        = !empty($body['qa_id'])         ? (int)$body['qa_id']        : null;
        if (array_key_exists('target_date',   $body)) $updates['target_date']   = $body['target_date']   ?: null;
        if (array_key_exists('reported_date', $body)) $updates['reported_date'] = $body['reported_date'] ?: null;

        if (!empty($updates)) {
            Database::update('ops_bugs', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
            if (isset($updates['status']) && $updates['status'] !== $bug['status']) {
                Database::insert('ops_activity_log', [
                    'tenant_id'   => $tenantId,
                    'entity_type' => 'bug',
                    'entity_id'   => $id,
                    'action'      => 'status_changed',
                    'description' => "Status changed from {$bug['status']} to {$updates['status']}",
                    'done_by'     => $body['updated_by'] ?? '',
                ]);
            }
        }

        $row = Database::fetch('SELECT * FROM ops_bugs WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row));
    }

    public function addComment(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();
        $comment  = trim((string)($body['comment'] ?? ''));
        $dueDate  = !empty($body['due_date']) ? $body['due_date'] : null;

        if (!$comment) Response::error('Comment is required', 422);

        Database::fetch(
            'SELECT id FROM ops_bugs WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        ) ?: Response::error('Bug not found', 404);

        $insertData = [
            'tenant_id' => $tenantId,
            'bug_id'    => $id,
            'comment'   => $comment,
            'added_by'  => trim((string)($body['added_by'] ?? '')),
        ];
        if ($dueDate !== null) $insertData['due_date'] = $dueDate;

        $commentId = Database::insert('ops_bug_comments', $insertData);

        $row = Database::fetch('SELECT * FROM ops_bug_comments WHERE id = ? LIMIT 1', [$commentId]);
        Response::success($row, 'Comment added', 201);
    }

    public function updateComment(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $commentId = (int) $request->param('cid');
        $tenantId  = Database::tenantId();
        $body      = $request->body();

        $comment = Database::fetch(
            'SELECT id FROM ops_bug_comments WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$commentId, $tenantId]
        );
        if (!$comment) Response::error('Comment not found', 404);

        $updates = [];
        if (array_key_exists('due_date', $body)) {
            $updates['due_date'] = $body['due_date'] ?: null;
        }
        if (array_key_exists('comment', $body)) {
            $updates['comment'] = trim((string)$body['comment']);
        }

        if (!empty($updates)) {
            Database::update('ops_bug_comments', $updates, ['id' => $commentId, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch('SELECT * FROM ops_bug_comments WHERE id = ? LIMIT 1', [$commentId]);
        Response::success($row);
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_bugs WHERE id = ? AND tenant_id = ?', [$id, $tenantId])
            ?: Response::error('Bug not found', 404);
        Database::update('ops_bugs', ['status' => 'closed'], ['id' => $id, 'tenant_id' => $tenantId]);
        Response::success(['message' => 'Bug closed']);
    }

    private function format(array $row): array
    {
        return [
            'id'             => (int)$row['id'],
            'project_id'     => (int)$row['project_id'],
            'project_name'   => $row['project_name'] ?? null,
            'module'         => $row['module'],
            'description'    => $row['description'],
            'type'           => $row['type'],
            'priority'       => $row['priority'],
            'reported_by'    => $row['reported_by'],
            'reported_date'  => $row['reported_date'] ?? null,
            'developer_id'   => $row['developer_id'] ? (int)$row['developer_id'] : null,
            'developer_name' => $row['developer_name'] ?? null,
            'qa_id'          => $row['qa_id'] ? (int)$row['qa_id'] : null,
            'qa_name'        => $row['qa_name'] ?? null,
            'status'         => $row['status'],
            'target_date'    => $row['target_date'],
            'steps_to_repro' => $row['steps_to_repro'],
            'parent_bug_id'  => $row['parent_bug_id'] ? (int)$row['parent_bug_id'] : null,
            'created_at'     => $row['created_at'],
            'updated_at'     => $row['updated_at'],
        ];
    }
}
