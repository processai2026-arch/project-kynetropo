<?php
declare(strict_types=1);

/**
 * RBAC admin: custom roles + granular permissions, assignable to admin users.
 * All tenant-scoped via the Role model. Additive to the built-in staff_role.
 */
class AdminRoleController
{
    public function index(Request $request): void
    {
        Response::success([
            'roles'   => Role::all(),
            'catalog' => Role::catalog(),
        ]);
    }

    public function permissions(Request $request): void
    {
        Response::success(['catalog' => Role::catalog(), 'all' => Role::allPermissions()]);
    }

    public function store(Request $request): void
    {
        $name = trim((string)$request->input('name', ''));
        if (mb_strlen($name) < 2) {
            Response::error('Role name is required', 422);
        }
        $perms = $request->input('permissions', []);
        if (!is_array($perms)) $perms = [];

        try {
            $id = Role::create($name, trim((string)$request->input('description', '')) ?: null, $perms);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') Response::error('A role with that name already exists', 409);
            error_log('Role create error: ' . $e->getMessage());
            Response::error('Could not create role', 500);
        }
        $this->audit($request, 'role_created', $id, ['name' => $name]);
        Response::success(Role::findById($id), 'Role created', 201);
    }

    public function update(Request $request): void
    {
        $id = (int)$request->param('id');
        $role = Role::findById($id);
        if (!$role) Response::error('Role not found', 404);
        if ($role['is_system']) Response::error('System roles cannot be edited', 409);

        $fields = [];
        if ($request->input('name') !== null)        $fields['name'] = trim((string)$request->input('name'));
        if ($request->input('description') !== null) $fields['description'] = trim((string)$request->input('description')) ?: null;
        if ($request->input('permissions') !== null && is_array($request->input('permissions'))) {
            $fields['permissions'] = $request->input('permissions');
        }
        if (!$fields) Response::error('Nothing to update', 400);

        Role::update($id, $fields);
        $this->audit($request, 'role_updated', $id, $fields);
        Response::success(Role::findById($id), 'Role updated');
    }

    public function destroy(Request $request): void
    {
        $id = (int)$request->param('id');
        $role = Role::findById($id);
        if (!$role) Response::error('Role not found', 404);
        if ($role['is_system']) Response::error('System roles cannot be deleted', 409);
        Role::delete($id);
        $this->audit($request, 'role_deleted', $id, ['name' => $role['name']]);
        Response::success(null, 'Role deleted');
    }

    public function assign(Request $request): void
    {
        $userId = (int)$request->input('user_id');
        $roleId = (int)$request->param('id');
        if ($userId <= 0 || !Role::findById($roleId)) Response::error('Invalid user or role', 422);
        $this->assertUserInTenant($userId);
        Role::assign($userId, $roleId);
        $this->audit($request, 'role_assigned', $roleId, ['user_id' => $userId]);
        Response::success(['permissions' => Role::permissionsForUser($userId)], 'Role assigned');
    }

    public function unassign(Request $request): void
    {
        $userId = (int)$request->input('user_id');
        $roleId = (int)$request->param('id');
        $this->assertUserInTenant($userId);
        Role::unassign($userId, $roleId);
        $this->audit($request, 'role_unassigned', $roleId, ['user_id' => $userId]);
        Response::success(['permissions' => Role::permissionsForUser($userId)], 'Role removed');
    }

    public function userPermissions(Request $request): void
    {
        $userId = (int)$request->param('id');
        $this->assertUserInTenant($userId);
        Response::success([
            'roles'       => Role::rolesForUser($userId),
            'permissions' => Role::permissionsForUser($userId),
        ]);
    }

    private function assertUserInTenant(int $userId): void
    {
        $row = Database::fetch('SELECT user_id FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1', [$userId, Database::tenantId()]);
        if (!$row) Response::error('User not found in this tenant', 404);
    }

    private function audit(Request $request, string $action, int $recordId, mixed $after): void
    {
        Database::execute(
            'INSERT INTO audit_log (tenant_id, user_id, action, table_name, record_id, old_value, new_value, ip_address, created_at)
             VALUES (?, ?, ?, "roles", ?, NULL, ?, ?, NOW())',
            [
                Database::tenantId(),
                isset($request->user['user_id']) ? (int)$request->user['user_id'] : null,
                $action, $recordId,
                $after !== null ? json_encode($after, JSON_UNESCAPED_UNICODE) : null,
                $request->ip(),
            ]
        );
    }
}
