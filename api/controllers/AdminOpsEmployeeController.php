<?php
declare(strict_types=1);

/**
 * Ops Employees Controller
 * GET    /admin/ops/employees          — list
 * GET    /admin/ops/employees/{id}     — detail
 * POST   /admin/ops/employees          — create
 * PUT    /admin/ops/employees/{id}     — update
 * DELETE /admin/ops/employees/{id}     — deactivate
 */
class AdminOpsEmployeeController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $status   = $request->query('status');
        $role     = $request->query('role');

        $sql    = 'SELECT * FROM ops_employees WHERE tenant_id = ?';
        $params = [$tenantId];
        if ($status) { $sql .= ' AND status = ?'; $params[] = $status; }
        if ($role)   { $sql .= ' AND role = ?';   $params[] = $role; }
        $sql .= ' ORDER BY name ASC';
        Response::success(array_map([$this, 'format'], Database::fetchAll($sql, $params)));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $emp = Database::fetch(
            'SELECT * FROM ops_employees WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$emp) Response::error('Employee not found', 404);

        $bugsReported = Database::fetch(
            "SELECT COUNT(*) AS cnt FROM ops_bugs WHERE tenant_id = ? AND reported_by = ?",
            [$tenantId, $emp['name']]
        );
        $bugsResolved = Database::fetch(
            "SELECT COUNT(*) AS cnt FROM ops_bugs WHERE tenant_id = ? AND developer_id = ? AND status IN ('fixed','closed')",
            [$tenantId, $id]
        );

        $data = $this->format($emp);
        $data['bugs_reported'] = (int)($bugsReported['cnt'] ?? 0);
        $data['bugs_resolved'] = (int)($bugsResolved['cnt'] ?? 0);
        Response::success($data);
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();
        $name     = trim((string)($body['name'] ?? ''));
        if (!$name) Response::error('Name is required', 422);

        $validRoles  = ['founder','qa_tester','sales_caller','trainer','developer','other'];
        $validAccess = ['full','bugs_only','clients_readonly','clients_followups'];

        $id = Database::insert('ops_employees', [
            'tenant_id'    => $tenantId,
            'name'         => $name,
            'phone'        => trim((string)($body['phone'] ?? '')),
            'email'        => strtolower(trim((string)($body['email'] ?? ''))),
            'role'         => in_array($body['role'] ?? '', $validRoles)  ? $body['role']  : 'other',
            'access_level' => in_array($body['access_level'] ?? '', $validAccess) ? $body['access_level'] : 'clients_readonly',
            'monthly_pay'  => (float)($body['monthly_pay'] ?? 0),
            'start_date'   => $body['start_date'] ?? null,
            'status'       => 'active',
            'notes'        => trim((string)($body['notes'] ?? '')),
        ]);

        $row = Database::fetch('SELECT * FROM ops_employees WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $emp = Database::fetch(
            'SELECT id FROM ops_employees WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$emp) Response::error('Employee not found', 404);

        $updates = [];
        foreach (['name','phone','email','notes'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        if (isset($body['monthly_pay'])) $updates['monthly_pay'] = (float)$body['monthly_pay'];
        if (array_key_exists('start_date', $body)) $updates['start_date'] = $body['start_date'] ?: null;

        $validRoles  = ['founder','qa_tester','sales_caller','trainer','developer','other'];
        $validAccess = ['full','bugs_only','clients_readonly','clients_followups'];
        if (isset($body['role']) && in_array($body['role'], $validRoles)) $updates['role'] = $body['role'];
        if (isset($body['access_level']) && in_array($body['access_level'], $validAccess)) $updates['access_level'] = $body['access_level'];
        if (isset($body['status']) && in_array($body['status'], ['active','inactive'])) $updates['status'] = $body['status'];

        if (!empty($updates)) {
            Database::update('ops_employees', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch('SELECT * FROM ops_employees WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_employees WHERE id = ? AND tenant_id = ?', [$id, $tenantId])
            ?: Response::error('Employee not found', 404);
        Database::update('ops_employees', ['status' => 'inactive'], ['id' => $id, 'tenant_id' => $tenantId]);
        Response::success(['message' => 'Employee deactivated']);
    }

    private function format(array $row): array
    {
        return [
            'id'           => (int)$row['id'],
            'name'         => $row['name'],
            'phone'        => $row['phone'],
            'email'        => $row['email'],
            'role'         => $row['role'],
            'access_level' => $row['access_level'],
            'monthly_pay'  => (float)$row['monthly_pay'],
            'start_date'   => $row['start_date'],
            'status'       => $row['status'],
            'notes'        => $row['notes'],
            'created_at'   => $row['created_at'],
        ];
    }
}
