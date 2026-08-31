<?php
declare(strict_types=1);

/**
 * Sales Access Control Controller (Admin → Access Control → Sales).
 *
 *   GET  /admin/sales/me                       — the caller's own sales permissions
 *   GET  /admin/sales/users                    — sales users + their permissions (admin)
 *   GET  /admin/sales/permissions              — the permission catalogue (admin)
 *   PUT  /admin/sales/users/{id}/permissions   — set a user's sales permissions (admin)
 *
 * Permissions are stored in the EXISTING RBAC tables (roles/user_roles). Each
 * sales user gets one managed role named "Sales — {name}" holding exactly the
 * sales permissions granted to them, so this screen never bypasses or
 * duplicates the platform's role system.
 */
class AdminSalesAccessController
{
    private const MANAGED_ROLE_PREFIX = 'Sales — ';

    /**
     * GET /admin/sales/me — used by the frontend to decide what to render.
     * Rendering is a convenience; every endpoint re-checks server-side.
     */
    public function me(Request $request): void
    {
        $user = $request->user ?? [];
        Response::success([
            'user_id'     => isset($user['user_id']) ? (int)$user['user_id'] : null,
            'name'        => $user['name']  ?? '',
            'email'       => $user['email'] ?? '',
            'staff_role'  => $user['staff_role'] ?? null,
            'is_admin'    => SalesPermissions::isAdmin($user),
            'permissions' => SalesPermissions::forUser($user),
            'server_time' => SalesChallenge::serverTime(),
        ]);
    }

    public function permissions(Request $request): void
    {
        $this->enforceAdmin($request);
        Response::success([
            'catalog'    => SalesPermissions::CATALOG,
            'all'        => SalesPermissions::all(),
            'admin_only' => SalesPermissions::ADMIN_ONLY,
        ]);
    }

    /** GET /admin/sales/users — every admin user with their effective sales access. */
    public function users(Request $request): void
    {
        $this->enforceAdmin($request);

        $rows = Database::fetchAll(
            "SELECT user_id, name, email, phone, is_active"
            . (User::hasStaffRoleColumn() ? ', staff_role' : '') . "
               FROM users
              WHERE tenant_id = ? AND user_type = 'admin'
              ORDER BY name ASC",
            [Database::tenantId()]
        );

        $users = array_map(function (array $row): array {
            $user = $row + ['user_type' => 'admin'];
            return [
                'user_id'     => (int)$row['user_id'],
                'name'        => $row['name'],
                'email'       => $row['email'],
                'phone'       => $row['phone'],
                'is_active'   => (bool)$row['is_active'],
                'staff_role'  => $row['staff_role'] ?? null,
                'is_admin'    => SalesPermissions::isAdmin($user),
                'permissions' => SalesPermissions::forUser($user),
                'granted'     => $this->grantedPermissions((int)$row['user_id']),
            ];
        }, $rows);

        Response::success($users);
    }

    /**
     * PUT /admin/sales/users/{id}/permissions
     * body: { permissions: string[] }
     */
    public function setPermissions(Request $request): void
    {
        $this->enforceAdmin($request);

        $userId = (int)$request->param('id');
        $target = Database::fetch(
            "SELECT user_id, name FROM users WHERE user_id = ? AND tenant_id = ? AND user_type = 'admin' LIMIT 1",
            [$userId, Database::tenantId()]
        );
        if (!$target) {
            Response::error('User not found in this workspace', 404);
        }

        $requested = $request->input('permissions', []);
        if (!is_array($requested)) {
            Response::error('permissions must be an array', 422);
        }

        // Silently drop anything outside this module's catalogue.
        $permissions = array_values(array_intersect($requested, SalesPermissions::all()));

        $roleName = self::MANAGED_ROLE_PREFIX . $target['name'] . ' #' . $userId;
        $existing = Database::fetch(
            'SELECT role_id FROM roles WHERE tenant_id = ? AND name = ? LIMIT 1',
            [Database::tenantId(), $roleName]
        );

        if ($existing) {
            $roleId = (int)$existing['role_id'];
            Database::execute(
                'UPDATE roles SET permissions = ?, description = ? WHERE role_id = ? AND tenant_id = ?',
                [
                    json_encode($permissions),
                    'Sales module access managed from Admin → Access Control',
                    $roleId,
                    Database::tenantId(),
                ]
            );
        } else {
            $roleId = Database::insert('roles', [
                'tenant_id'   => Database::tenantId(),
                'name'        => $roleName,
                'description' => 'Sales module access managed from Admin → Access Control',
                'permissions' => json_encode($permissions),
                'is_system'   => 0,
            ]);
        }

        Database::execute(
            'INSERT IGNORE INTO user_roles (tenant_id, user_id, role_id) VALUES (?, ?, ?)',
            [Database::tenantId(), $userId, $roleId]
        );

        $this->audit($request, 'sales_permissions_updated', $userId, [
            'permissions' => $permissions,
            'role_id'     => $roleId,
        ]);

        Response::success([
            'user_id'     => $userId,
            'granted'     => $permissions,
            'permissions' => $this->effectiveForUser($userId),
        ], 'Sales permissions updated');
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Only a sales administrator may read or change access control. The 'admin'
     * route guard already ran; this is the second, permission-level gate.
     */
    private function enforceAdmin(Request $request): void
    {
        if (!SalesPermissions::isAdmin($request->user ?? [])) {
            SalesPermissions::enforce($request->user, 'sales.challenges.manage');
        }
    }

    /** Sales permissions explicitly granted through RBAC (not role defaults). */
    private function grantedPermissions(int $userId): array
    {
        try {
            return array_values(array_intersect(Role::permissionsForUser($userId), SalesPermissions::all()));
        } catch (Throwable $e) {
            error_log('[SalesAccess] granted lookup failed: ' . $e->getMessage());
            return [];
        }
    }

    private function effectiveForUser(int $userId): array
    {
        $row = Database::fetch(
            'SELECT user_id, user_type' . (User::hasStaffRoleColumn() ? ', staff_role' : '')
            . ' FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1',
            [$userId, Database::tenantId()]
        );
        return $row ? SalesPermissions::forUser($row) : [];
    }

    private function audit(Request $request, string $action, int $recordId, array $after): void
    {
        try {
            Database::execute(
                'INSERT INTO audit_log (tenant_id, user_id, action, table_name, record_id, old_value, new_value, ip_address, created_at)
                 VALUES (?, ?, ?, "users", ?, NULL, ?, ?, NOW())',
                [
                    Database::tenantId(),
                    isset($request->user['user_id']) ? (int)$request->user['user_id'] : null,
                    $action,
                    $recordId,
                    json_encode($after, JSON_UNESCAPED_UNICODE),
                    $request->ip(),
                ]
            );
        } catch (Throwable $e) {
            error_log('[SalesAccess] audit failed: ' . $e->getMessage());
        }
    }
}
