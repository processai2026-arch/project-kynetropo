<?php
declare(strict_types=1);

/**
 * Ops Hiring Controller
 * GET    /admin/ops/hiring             — candidates list
 * POST   /admin/ops/hiring             — add candidate
 * PUT    /admin/ops/hiring/{id}        — update (select → auto-creates employee)
 * DELETE /admin/ops/hiring/{id}
 */
class AdminOpsHiringController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $decision = $request->query('decision');

        $sql    = 'SELECT * FROM ops_hiring_candidates WHERE tenant_id = ?';
        $params = [$tenantId];
        if ($decision) { $sql .= ' AND decision = ?'; $params[] = $decision; }
        $sql .= ' ORDER BY created_at DESC';
        Response::success(Database::fetchAll($sql, $params));
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();
        $name     = trim((string)($body['name'] ?? ''));
        if (!$name) Response::error('Name is required', 422);

        $id = Database::insert('ops_hiring_candidates', [
            'tenant_id'         => $tenantId,
            'name'              => $name,
            'email'             => trim((string)($body['email'] ?? '')) ?: null,
            'phone'             => trim((string)($body['phone'] ?? '')) ?: null,
            'assignment_sent'   => $body['assignment_sent']  ?? null,
            'assignment_due'    => $body['assignment_due']   ?? null,
            'submitted'         => (int)(bool)($body['submitted'] ?? false),
            'workflow_bugs'     => (int)($body['workflow_bugs']     ?? 0),
            'critical_bugs'     => (int)($body['critical_bugs']     ?? 0),
            'reporting_quality' => (int)($body['reporting_quality'] ?? 0),
            'reasoning_quality' => (int)($body['reasoning_quality'] ?? 0),
            'score'             => (float)($body['score'] ?? 0),
            'decision'          => 'pending',
            'start_date'        => $body['start_date'] ?? null,
            'notes'             => trim((string)($body['notes'] ?? '')),
        ]);

        $row = Database::fetch('SELECT * FROM ops_hiring_candidates WHERE id = ? LIMIT 1', [$id]);
        Response::success($row, 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $candidate = Database::fetch(
            'SELECT * FROM ops_hiring_candidates WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$candidate) Response::error('Candidate not found', 404);

        $updates = [];
        foreach (['name','email','phone','notes','rejection_reason'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        foreach (['assignment_sent','assignment_due','start_date'] as $f) {
            if (array_key_exists($f, $body)) $updates[$f] = $body[$f] ?: null;
        }
        foreach (['workflow_bugs','critical_bugs','reporting_quality','reasoning_quality'] as $f) {
            if (isset($body[$f])) $updates[$f] = (int)$body[$f];
        }
        if (isset($body['score']))    $updates['score']    = (float)$body['score'];
        if (isset($body['submitted'])) $updates['submitted'] = (int)(bool)$body['submitted'];
        if (isset($body['decision']) && in_array($body['decision'], ['pending','selected','rejected'])) {
            $updates['decision'] = $body['decision'];
        }

        if (!empty($updates)) {
            Database::update('ops_hiring_candidates', $updates, ['id' => $id, 'tenant_id' => $tenantId]);

            // Auto-create employee when selected
            if (($updates['decision'] ?? '') === 'selected' && $candidate['decision'] !== 'selected') {
                $existingEmployee = Database::fetch(
                    'SELECT id FROM ops_employees WHERE tenant_id = ? AND name = ? LIMIT 1',
                    [$tenantId, $candidate['name']]
                );
                if (!$existingEmployee) {
                    Database::insert('ops_employees', [
                        'tenant_id'    => $tenantId,
                        'name'         => $candidate['name'],
                        'phone'        => $candidate['phone'] ?? '',
                        'email'        => $candidate['email'] ?? '',
                        'role'         => 'qa_tester',
                        'access_level' => 'bugs_only',
                        'monthly_pay'  => 0,
                        'start_date'   => $updates['start_date'] ?? $candidate['start_date'] ?? null,
                        'status'       => 'active',
                    ]);
                }
            }
        }

        $row = Database::fetch('SELECT * FROM ops_hiring_candidates WHERE id = ? LIMIT 1', [$id]);
        Response::success($row);
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_hiring_candidates WHERE id = ? AND tenant_id = ?', [$id, $tenantId])
            ?: Response::error('Candidate not found', 404);
        Database::query('DELETE FROM ops_hiring_candidates WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(['message' => 'Deleted']);
    }
}
