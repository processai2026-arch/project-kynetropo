<?php
declare(strict_types=1);

/**
 * Ops SOP Controller
 *
 * GET    /admin/ops/sop/modules              — list all modules (with sop count)
 * POST   /admin/ops/sop/modules              — create module
 * PUT    /admin/ops/sop/modules/{id}         — rename module
 * DELETE /admin/ops/sop/modules/{id}         — delete module (cascades SOPs)
 *
 * GET    /admin/ops/sop/modules/{module_id}/sops        — list SOPs in a module
 * POST   /admin/ops/sop/modules/{module_id}/sops        — create SOP
 * GET    /admin/ops/sop/sops/{id}                       — SOP detail with version history
 * PUT    /admin/ops/sop/sops/{id}                       — update SOP (auto-saves version)
 * DELETE /admin/ops/sop/sops/{id}                       — delete SOP
 *
 * GET    /admin/ops/sop/sops/{id}/versions              — version history
 */
class AdminOpsSopController
{
    // ── Modules ────────────────────────────────────────────────────────────────

    public function listModules(Request $request): void
    {
        $tenantId = Database::tenantId();
        $modules  = Database::fetchAll(
            "SELECT m.*, COUNT(s.id) AS sop_count
             FROM ops_sop_modules m
             LEFT JOIN ops_sops s ON s.module_id = m.id AND s.tenant_id = m.tenant_id
             WHERE m.tenant_id = ?
             GROUP BY m.id
             ORDER BY m.position ASC, m.created_at ASC",
            [$tenantId]
        );
        Response::success($modules);
    }

    public function createModule(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();
        $name     = trim((string)($body['name'] ?? ''));
        if (!$name) Response::error('Module name is required', 422);

        $maxPos = Database::fetch(
            'SELECT COALESCE(MAX(position),0)+1 AS pos FROM ops_sop_modules WHERE tenant_id = ?',
            [$tenantId]
        );

        $id = Database::insert('ops_sop_modules', [
            'tenant_id'   => $tenantId,
            'name'        => $name,
            'description' => trim((string)($body['description'] ?? '')) ?: null,
            'position'    => (int)$maxPos['pos'],
            'created_by'  => trim((string)($body['created_by'] ?? '')),
        ]);

        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'sop_module',
            'entity_id'   => $id,
            'action'      => 'created',
            'description' => "SOP module '{$name}' created",
            'done_by'     => trim((string)($body['created_by'] ?? '')),
        ]);

        $row = Database::fetch('SELECT * FROM ops_sop_modules WHERE id = ? LIMIT 1', [$id]);
        Response::success($row, 'Module created', 201);
    }

    public function updateModule(Request $request): void
    {
        $id       = (int) $request->param('id');
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $module = Database::fetch(
            'SELECT * FROM ops_sop_modules WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$module) Response::error('Module not found', 404);

        $updates = [];
        if (isset($body['name']))        $updates['name']        = trim((string)$body['name']);
        if (isset($body['description'])) $updates['description'] = trim((string)$body['description']) ?: null;
        if (isset($body['position']))    $updates['position']    = (int)$body['position'];

        if (empty($updates)) Response::error('Nothing to update', 422);
        if (isset($updates['name']) && !$updates['name']) Response::error('Name cannot be empty', 422);

        Database::update('ops_sop_modules', $updates, ['id' => $id, 'tenant_id' => $tenantId]);

        if (isset($updates['name'])) {
            Database::insert('ops_activity_log', [
                'tenant_id'   => $tenantId,
                'entity_type' => 'sop_module',
                'entity_id'   => $id,
                'action'      => 'updated',
                'description' => "SOP module renamed to '{$updates['name']}'",
                'done_by'     => trim((string)($body['updated_by'] ?? '')),
            ]);
        }

        $row = Database::fetch('SELECT * FROM ops_sop_modules WHERE id = ? LIMIT 1', [$id]);
        Response::success($row);
    }

    public function deleteModule(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $module = Database::fetch(
            'SELECT * FROM ops_sop_modules WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$module) Response::error('Module not found', 404);

        // CASCADE deletes ops_sops and ops_sop_versions via FK
        Database::query(
            'DELETE FROM ops_sop_modules WHERE id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'sop_module',
            'entity_id'   => $id,
            'action'      => 'deleted',
            'description' => "SOP module '{$module['name']}' deleted",
            'done_by'     => '',
        ]);

        Response::success(['deleted' => true]);
    }

    // ── SOPs ───────────────────────────────────────────────────────────────────

    public function listSops(Request $request): void
    {
        $moduleId = (int) $request->param('module_id');
        $tenantId = Database::tenantId();

        $module = Database::fetch(
            'SELECT id FROM ops_sop_modules WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$moduleId, $tenantId]
        );
        if (!$module) Response::error('Module not found', 404);

        $sops = Database::fetchAll(
            'SELECT * FROM ops_sops WHERE module_id = ? AND tenant_id = ? ORDER BY position ASC, created_at ASC',
            [$moduleId, $tenantId]
        );
        Response::success($sops);
    }

    public function createSop(Request $request): void
    {
        $moduleId = (int) $request->param('module_id');
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $module = Database::fetch(
            'SELECT id FROM ops_sop_modules WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$moduleId, $tenantId]
        );
        if (!$module) Response::error('Module not found', 404);

        $title = trim((string)($body['title'] ?? ''));
        if (!$title) Response::error('Title is required', 422);

        $maxPos = Database::fetch(
            'SELECT COALESCE(MAX(position),0)+1 AS pos FROM ops_sops WHERE module_id = ? AND tenant_id = ?',
            [$moduleId, $tenantId]
        );

        $id = Database::insert('ops_sops', [
            'tenant_id'  => $tenantId,
            'module_id'  => $moduleId,
            'title'      => $title,
            'content'    => trim((string)($body['content'] ?? '')) ?: null,
            'position'   => (int)$maxPos['pos'],
            'created_by' => trim((string)($body['created_by'] ?? '')),
        ]);

        // Save initial version
        Database::insert('ops_sop_versions', [
            'tenant_id'  => $tenantId,
            'sop_id'     => $id,
            'version_no' => 1,
            'title'      => $title,
            'content'    => trim((string)($body['content'] ?? '')) ?: null,
            'saved_by'   => trim((string)($body['created_by'] ?? '')),
        ]);

        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'sop',
            'entity_id'   => $id,
            'action'      => 'created',
            'description' => "SOP '{$title}' created",
            'done_by'     => trim((string)($body['created_by'] ?? '')),
        ]);

        $row = Database::fetch('SELECT * FROM ops_sops WHERE id = ? LIMIT 1', [$id]);
        Response::success($row, 'SOP created', 201);
    }

    public function showSop(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $sop = Database::fetch(
            'SELECT s.*, m.name AS module_name FROM ops_sops s
             JOIN ops_sop_modules m ON m.id = s.module_id
             WHERE s.id = ? AND s.tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$sop) Response::error('SOP not found', 404);

        $versions = Database::fetchAll(
            'SELECT * FROM ops_sop_versions WHERE sop_id = ? AND tenant_id = ? ORDER BY version_no DESC',
            [$id, $tenantId]
        );

        Response::success(array_merge($sop, ['versions' => $versions]));
    }

    public function updateSop(Request $request): void
    {
        $id       = (int) $request->param('id');
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $sop = Database::fetch(
            'SELECT * FROM ops_sops WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$sop) Response::error('SOP not found', 404);

        $updates = [];
        if (isset($body['title']))   $updates['title']   = trim((string)$body['title']);
        if (isset($body['content'])) $updates['content'] = trim((string)$body['content']) ?: null;

        if (empty($updates)) Response::error('Nothing to update', 422);
        if (isset($updates['title']) && !$updates['title']) Response::error('Title cannot be empty', 422);

        Database::update('ops_sops', $updates, ['id' => $id, 'tenant_id' => $tenantId]);

        // Auto-save version snapshot
        $maxVer = Database::fetch(
            'SELECT COALESCE(MAX(version_no),0)+1 AS v FROM ops_sop_versions WHERE sop_id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );
        Database::insert('ops_sop_versions', [
            'tenant_id'  => $tenantId,
            'sop_id'     => $id,
            'version_no' => (int)$maxVer['v'],
            'title'      => $updates['title'] ?? $sop['title'],
            'content'    => $updates['content'] ?? $sop['content'],
            'saved_by'   => trim((string)($body['updated_by'] ?? '')),
        ]);

        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'sop',
            'entity_id'   => $id,
            'action'      => 'updated',
            'description' => "SOP '{$sop['title']}' updated (v" . (int)$maxVer['v'] . ")",
            'done_by'     => trim((string)($body['updated_by'] ?? '')),
        ]);

        $row = Database::fetch('SELECT * FROM ops_sops WHERE id = ? LIMIT 1', [$id]);
        Response::success($row);
    }

    public function deleteSop(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $sop = Database::fetch(
            'SELECT * FROM ops_sops WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$sop) Response::error('SOP not found', 404);

        // CASCADE deletes ops_sop_versions via FK
        Database::query('DELETE FROM ops_sops WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);

        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'sop',
            'entity_id'   => $id,
            'action'      => 'deleted',
            'description' => "SOP '{$sop['title']}' deleted",
            'done_by'     => '',
        ]);

        Response::success(['deleted' => true]);
    }

    public function sopVersions(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $sop = Database::fetch(
            'SELECT id FROM ops_sops WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$sop) Response::error('SOP not found', 404);

        $versions = Database::fetchAll(
            'SELECT * FROM ops_sop_versions WHERE sop_id = ? AND tenant_id = ? ORDER BY version_no DESC',
            [$id, $tenantId]
        );
        Response::success($versions);
    }

    // ── SOP Files ──────────────────────────────────────────────────────────────

    public function listSopFiles(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        Database::fetch(
            'SELECT id FROM ops_sops WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        ) ?: Response::error('SOP not found', 404);

        $files = Database::fetchAll(
            'SELECT * FROM ops_sop_files WHERE sop_id = ? AND tenant_id = ? ORDER BY version_no DESC',
            [$id, $tenantId]
        );
        Response::success($files);
    }

    public function uploadSopFile(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        Database::fetch(
            'SELECT id FROM ops_sops WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        ) ?: Response::error('SOP not found', 404);

        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::error('File upload failed or no file provided', 422);
        }

        $file     = $_FILES['file'];
        $origName = basename($file['name']);
        $ext      = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowed  = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'txt', 'ppt', 'pptx'];
        if (!in_array($ext, $allowed)) Response::error('File type not allowed', 422);

        $stored = FileStore::put($file['tmp_name'], "sop/{$tenantId}/{$id}", $origName);

        $maxVer = Database::fetch(
            'SELECT COALESCE(MAX(version_no),0)+1 AS v FROM ops_sop_files WHERE sop_id = ? AND tenant_id = ?',
            [$id, $tenantId]
        );

        $uploadedBy = trim((string)($_POST['uploaded_by'] ?? ''));
        $fileId = Database::insert('ops_sop_files', [
            'tenant_id'   => $tenantId,
            'sop_id'      => $id,
            'file_path'   => $stored,
            'file_name'   => $origName,
            'version_no'  => (int)$maxVer['v'],
            'uploaded_by' => $uploadedBy,
        ]);

        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'sop',
            'entity_id'   => $id,
            'action'      => 'file_uploaded',
            'description' => "File '{$origName}' uploaded to SOP (v" . (int)$maxVer['v'] . ")",
            'done_by'     => $uploadedBy,
        ]);

        $row = Database::fetch('SELECT * FROM ops_sop_files WHERE id = ? LIMIT 1', [$fileId]);
        Response::success($row, 'File uploaded', 201);
    }

    public function deleteSopFile(Request $request): void
    {
        $id       = (int) $request->param('id');
        $fileId   = (int) $request->param('file_id');
        $tenantId = Database::tenantId();

        $file = Database::fetch(
            'SELECT * FROM ops_sop_files WHERE id = ? AND sop_id = ? AND tenant_id = ? LIMIT 1',
            [$fileId, $id, $tenantId]
        );
        if (!$file) Response::error('File not found', 404);

        Database::query(
            'DELETE FROM ops_sop_files WHERE id = ? AND tenant_id = ?',
            [$fileId, $tenantId]
        );

        Response::success(['deleted' => true]);
    }
}
