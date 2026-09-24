<?php
declare(strict_types=1);

/**
 * Ops Process Steps Controller
 *
 * GET    /admin/ops/process/steps                     — full tree (steps + substeps)
 * POST   /admin/ops/process/steps                     — create step
 * PUT    /admin/ops/process/steps/{id}                — update step
 * DELETE /admin/ops/process/steps/{id}                — delete step (cascades substeps)
 *
 * POST   /admin/ops/process/steps/{step_id}/substeps  — add substep
 * PUT    /admin/ops/process/substeps/{id}             — update substep
 * DELETE /admin/ops/process/substeps/{id}             — delete substep
 */
class AdminOpsProcessController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();

        $steps = Database::fetchAll(
            'SELECT * FROM ops_process_steps WHERE tenant_id = ? ORDER BY position ASC, id ASC',
            [$tenantId]
        );

        $substeps = Database::fetchAll(
            'SELECT * FROM ops_process_substeps WHERE tenant_id = ? ORDER BY position ASC, id ASC',
            [$tenantId]
        );

        // Nest substeps under their step, with children nested under parent substep
        $byStep   = [];
        $byParent = [];
        foreach ($substeps as $s) {
            if ($s['parent_substep_id']) {
                $byParent[(int)$s['parent_substep_id']][] = $s;
            } else {
                $byStep[(int)$s['step_id']][] = $s;
            }
        }

        $nest = function(array &$items) use (&$nest, $byParent): void {
            foreach ($items as &$item) {
                $children = $byParent[(int)$item['id']] ?? [];
                $nest($children);
                $item['children'] = $children;
            }
        };

        foreach ($steps as &$step) {
            $subs = $byStep[(int)$step['id']] ?? [];
            $nest($subs);
            $step['substeps'] = $subs;
        }

        Response::success($steps);
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();
        $title    = trim((string)($body['title'] ?? ''));
        if (!$title) Response::error('Title is required', 422);

        $maxPos = Database::fetch(
            'SELECT COALESCE(MAX(position),0)+1 AS pos FROM ops_process_steps WHERE tenant_id = ?',
            [$tenantId]
        );

        // Allow inserting at a specific position (shift others)
        $position = isset($body['position']) ? (int)$body['position'] : (int)$maxPos['pos'];
        if (isset($body['position'])) {
            Database::query(
                'UPDATE ops_process_steps SET position = position + 1 WHERE tenant_id = ? AND position >= ?',
                [$tenantId, $position]
            );
        }

        $id = Database::insert('ops_process_steps', [
            'tenant_id' => $tenantId,
            'title'     => $title,
            'datetime'  => $body['datetime'] ?? null,
            'status'    => in_array($body['status'] ?? '', ['not_started','in_progress','done']) ? $body['status'] : 'not_started',
            'position'  => $position,
        ]);

        $row = Database::fetch('SELECT * FROM ops_process_steps WHERE id = ? LIMIT 1', [$id]);
        $row['substeps'] = [];
        Response::success($row, 'Step created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $step = Database::fetch(
            'SELECT * FROM ops_process_steps WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$step) Response::error('Step not found', 404);

        $updates = [];
        if (isset($body['title']))    $updates['title']    = trim((string)$body['title']);
        if (isset($body['datetime'])) $updates['datetime'] = $body['datetime'] ?: null;
        if (isset($body['status']) && in_array($body['status'], ['not_started','in_progress','done'])) {
            $updates['status'] = $body['status'];
        }
        if (isset($body['position'])) $updates['position'] = (int)$body['position'];

        if (empty($updates)) Response::error('Nothing to update', 422);
        Database::update('ops_process_steps', $updates, ['id' => $id, 'tenant_id' => $tenantId]);

        $row = Database::fetch('SELECT * FROM ops_process_steps WHERE id = ? LIMIT 1', [$id]);
        Response::success($row);
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        Database::fetch('SELECT id FROM ops_process_steps WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId])
            ?: Response::error('Step not found', 404);

        Database::query('DELETE FROM ops_process_steps WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(['deleted' => true]);
    }

    public function addSubstep(Request $request): void
    {
        $stepId   = (int) $request->param('step_id');
        $body     = $request->body();
        $tenantId = Database::tenantId();

        Database::fetch('SELECT id FROM ops_process_steps WHERE id = ? AND tenant_id = ? LIMIT 1', [$stepId, $tenantId])
            ?: Response::error('Step not found', 404);

        $title = trim((string)($body['title'] ?? ''));
        if (!$title) Response::error('Title is required', 422);

        $parentId = !empty($body['parent_substep_id']) ? (int)$body['parent_substep_id'] : null;
        $maxPos   = Database::fetch(
            'SELECT COALESCE(MAX(position),0)+1 AS pos FROM ops_process_substeps WHERE step_id = ? AND tenant_id = ?',
            [$stepId, $tenantId]
        );

        $id = Database::insert('ops_process_substeps', [
            'tenant_id'         => $tenantId,
            'step_id'           => $stepId,
            'parent_substep_id' => $parentId,
            'title'             => $title,
            'datetime'          => $body['datetime'] ?? null,
            'status'            => in_array($body['status'] ?? '', ['not_started','in_progress','done']) ? $body['status'] : 'not_started',
            'position'          => (int)$maxPos['pos'],
        ]);

        $row = Database::fetch('SELECT * FROM ops_process_substeps WHERE id = ? LIMIT 1', [$id]);
        $row['children'] = [];
        Response::success($row, 'Sub-step created', 201);
    }

    public function updateSubstep(Request $request): void
    {
        $id       = (int) $request->param('id');
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $sub = Database::fetch(
            'SELECT * FROM ops_process_substeps WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$sub) Response::error('Sub-step not found', 404);

        $updates = [];
        if (isset($body['title']))    $updates['title']    = trim((string)$body['title']);
        if (isset($body['datetime'])) $updates['datetime'] = $body['datetime'] ?: null;
        if (isset($body['status']) && in_array($body['status'], ['not_started','in_progress','done'])) {
            $updates['status'] = $body['status'];
        }
        if (isset($body['position'])) $updates['position'] = (int)$body['position'];

        if (empty($updates)) Response::error('Nothing to update', 422);
        Database::update('ops_process_substeps', $updates, ['id' => $id, 'tenant_id' => $tenantId]);

        $row = Database::fetch('SELECT * FROM ops_process_substeps WHERE id = ? LIMIT 1', [$id]);
        Response::success($row);
    }

    public function deleteSubstep(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        Database::fetch('SELECT id FROM ops_process_substeps WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId])
            ?: Response::error('Sub-step not found', 404);

        Database::query('DELETE FROM ops_process_substeps WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(['deleted' => true]);
    }
}
