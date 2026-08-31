<?php
declare(strict_types=1);

/**
 * Krish Agencies — Admin Employee Controller
 * Manages the field staff (employees) table.
 * Class name is AdminKrishEmployeeController to avoid collision with
 * the template AdminEmployeeController loaded earlier in index.php.
 *
 * GET    /admin/employees          — list employees
 * GET    /admin/employees/{id}     — single employee
 * POST   /admin/employees          — create employee
 * PUT    /admin/employees/{id}     — update employee
 * DELETE /admin/employees/{id}     — deactivate employee
 */
class AdminKrishEmployeeController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $sql    = 'SELECT * FROM employees WHERE tenant_id = ?';
        $params = [$tenantId];

        if ($status = $request->query('status')) {
            $sql .= ' AND status = ?'; $params[] = $status;
        }
        if ($q = $request->query('search')) {
            $sql .= ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $like = '%' . $q . '%'; $params[] = $like; $params[] = $like; $params[] = $like;
        }

        $sql .= ' ORDER BY name ASC';
        $rows = Database::fetchAll($sql, $params);
        Response::success(array_map([$this, 'format'], $rows));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $row      = Database::fetch(
            'SELECT * FROM employees WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$row) Response::error('Employee not found', 404);
        Response::success($this->format($row));
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $name  = trim((string)($body['name']  ?? ''));
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $phone = trim((string)($body['phone'] ?? ''));

        if (!$name)  Response::error('Name is required', 422);
        if (!$email) Response::error('Email is required', 422);
        if (!$phone) Response::error('Phone is required', 422);

        $dup = Database::fetch(
            'SELECT id FROM employees WHERE email = ? AND tenant_id = ? LIMIT 1',
            [$email, $tenantId]
        );
        if ($dup) Response::error('Email already registered', 409);

        $id = Database::insert('employees', [
            'tenant_id'   => $tenantId,
            'name'        => $name,
            'email'       => $email,
            'phone'       => $phone,
            'designation' => trim((string)($body['designation'] ?? '')),
            'department'  => trim((string)($body['department']  ?? '')),
            'status'      => in_array($body['status'] ?? '', ['active','inactive']) ? $body['status'] : 'active',
            'notes'       => trim((string)($body['notes'] ?? '')),
        ]);

        $row = Database::fetch('SELECT * FROM employees WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $emp = Database::fetch(
            'SELECT id FROM employees WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$emp) Response::error('Employee not found', 404);

        $updates = [];
        foreach (['name','email','phone','designation','department','notes'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        if (isset($body['status']) && in_array($body['status'], ['active','inactive'])) {
            $updates['status'] = $body['status'];
        }

        if (!empty($updates)) {
            Database::update('employees', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch('SELECT * FROM employees WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $emp = Database::fetch(
            'SELECT id FROM employees WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$emp) Response::error('Employee not found', 404);

        Database::update('employees', ['status' => 'inactive'], ['id' => $id, 'tenant_id' => $tenantId]);
        Response::success(['message' => 'Employee deactivated']);
    }

    private function format(array $row): array
    {
        return [
            'id'          => (int)$row['id'],
            'name'        => $row['name'],
            'email'       => $row['email'],
            'phone'       => $row['phone'],
            'designation' => $row['designation'],
            'department'  => $row['department'],
            'status'      => $row['status'],
            'notes'       => $row['notes'],
            'user_id'     => $row['user_id'] ? (int)$row['user_id'] : null,
            'created_at'  => $row['created_at'],
        ];
    }
}
