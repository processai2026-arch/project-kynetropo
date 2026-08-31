<?php
declare(strict_types=1);

/**
 * Ops Project Credentials Controller
 * GET    /admin/ops/projects/{id}/credentials        — list
 * POST   /admin/ops/projects/{id}/credentials        — create
 * PUT    /admin/ops/projects/{id}/credentials/{cid}  — update
 * DELETE /admin/ops/projects/{id}/credentials/{cid}  — delete
 */
class AdminOpsCredentialController
{
    public function index(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $projectId = (int) $request->param('id');
        $tenantId  = Database::tenantId();

        Database::fetch(
            'SELECT id FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$projectId, $tenantId]
        ) ?: Response::error('Project not found', 404);

        $rows = Database::fetchAll(
            'SELECT * FROM ops_project_credentials WHERE project_id = ? AND tenant_id = ? ORDER BY label ASC',
            [$projectId, $tenantId]
        );

        Response::success(array_map([$this, 'format'], $rows));
    }

    public function store(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $projectId = (int) $request->param('id');
        $tenantId  = Database::tenantId();
        $body      = $request->body();

        $label = trim((string)($body['label'] ?? ''));
        if (!$label) Response::error('Label is required', 422);

        Database::fetch(
            'SELECT id FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$projectId, $tenantId]
        ) ?: Response::error('Project not found', 404);

        $id = Database::insert('ops_project_credentials', [
            'tenant_id'  => $tenantId,
            'project_id' => $projectId,
            'label'      => $label,
            'role'       => trim((string)($body['role']     ?? '')),
            'username'   => trim((string)($body['username'] ?? '')),
            'password'   => trim((string)($body['password'] ?? '')),
            'url'        => trim((string)($body['url']      ?? '')),
            'notes'      => trim((string)($body['notes']    ?? '')) ?: null,
            'created_by' => trim((string)($body['created_by'] ?? '')),
        ]);

        $row = Database::fetch('SELECT * FROM ops_project_credentials WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $projectId = (int) $request->param('id');
        $credId    = (int) $request->param('cid');
        $tenantId  = Database::tenantId();
        $body      = $request->body();

        $cred = Database::fetch(
            'SELECT * FROM ops_project_credentials WHERE id = ? AND project_id = ? AND tenant_id = ? LIMIT 1',
            [$credId, $projectId, $tenantId]
        );
        if (!$cred) Response::error('Credential not found', 404);

        $updates = [];
        foreach (['label','role','username','password','url'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        if (array_key_exists('notes', $body)) {
            $updates['notes'] = trim((string)$body['notes']) ?: null;
        }

        if (!empty($updates)) {
            Database::update('ops_project_credentials', $updates, ['id' => $credId, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch('SELECT * FROM ops_project_credentials WHERE id = ? LIMIT 1', [$credId]);
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        AuthMiddleware::handle($request);
        AdminMiddleware::handle($request);

        $projectId = (int) $request->param('id');
        $credId    = (int) $request->param('cid');
        $tenantId  = Database::tenantId();

        $cred = Database::fetch(
            'SELECT id FROM ops_project_credentials WHERE id = ? AND project_id = ? AND tenant_id = ? LIMIT 1',
            [$credId, $projectId, $tenantId]
        );
        if (!$cred) Response::error('Credential not found', 404);

        Database::query(
            'DELETE FROM ops_project_credentials WHERE id = ? AND tenant_id = ?',
            [$credId, $tenantId]
        );
        Response::success(['message' => 'Deleted']);
    }

    private function format(array $row): array
    {
        return [
            'id'         => (int)$row['id'],
            'project_id' => (int)$row['project_id'],
            'label'      => $row['label'],
            'role'       => $row['role'],
            'username'   => $row['username'],
            'password'   => $row['password'],
            'url'        => $row['url'],
            'notes'      => $row['notes'],
            'created_by' => $row['created_by'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }
}
