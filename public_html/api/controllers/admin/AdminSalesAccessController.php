<?php
declare(strict_types=1);

/**
 * Sales Access Control Controller (Admin → Access Control → Sales).
 *
 *   GET  /admin/sales/me                       — the caller's own sales permissions
 *   GET  /admin/sales/users                    — sales users + their permissions (admin)
 *   GET  /admin/sales/permissions              — the permission catalogue (admin)
 *   POST /admin/sales/users                    — create a sales user login (admin)
 *   PUT  /admin/sales/users/{id}/permissions   — set a user's sales permissions (admin)
 *   PUT  /admin/sales/users/{id}/role          — set a user's staff role (admin)
 *   PUT  /admin/sales/users/{id}/active        — enable/disable the login (admin)
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
        $user   = $request->user ?? [];
        $userId = isset($user['user_id']) ? (int)$user['user_id'] : 0;

        // Deliberately does not call enforce(): a salesperson whose access was
        // destroyed still has to load this to be shown what happened and who to
        // ask. Every other sales endpoint refuses them with 423.
        $lockout = $userId > 0 ? SalesLockout::active($userId) : null;

        Response::success([
            'user_id'     => $userId ?: null,
            'name'        => $user['name']  ?? '',
            'email'       => $user['email'] ?? '',
            'staff_role'  => $user['staff_role'] ?? null,
            'is_admin'    => SalesPermissions::isAdmin($user),
            'permissions' => SalesPermissions::forUser($user),
            'server_time' => SalesChallenge::serverTime(),
            'lockout'     => $lockout ? SalesLockout::format($lockout) : null,
        ]);
    }

    /**
     * GET /admin/sales/lockouts
     *
     * Everyone currently locked out of the app by a missed challenge, so an
     * administrator can see who is waiting on them.
     */
    public function lockouts(Request $request): void
    {
        $this->enforceAdmin($request);
        Response::success(SalesLockout::allActive());
    }

    /**
     * POST /admin/sales/users/{id}/restore-access
     *
     * Lifts a challenge lockout. The lockout row is kept and stamped with who
     * lifted it — the history of what happened outlives the punishment.
     */
    public function restoreAccess(Request $request): void
    {
        $this->enforceAdmin($request);

        $userId = (int)$request->param('id');
        $target = $this->findAdmin($userId);

        if (!SalesLockout::isLocked($userId)) {
            Response::error('That user is not locked out', 409);
        }

        SalesLockout::clear($userId, isset($request->user['user_id']) ? (int)$request->user['user_id'] : null);
        $this->audit($request, 'sales_access_restored', $userId, ['email' => $target['email'] ?? null]);

        Response::success(
            ['user_id' => $userId, 'name' => $target['name'] ?? null],
            'App access restored'
        );
    }

    /**
     * GET /admin/sales/assignable-users
     *
     * The people a challenge can be offered to, or a lead assigned to. Returns
     * names only — no emails, roles or permissions — so it can safely be opened
     * up to anyone who creates challenges or assigns leads, without exposing the
     * full access-control view that /admin/sales/users provides.
     */
    public function assignableUsers(Request $request): void
    {
        // Assigning a challenge, giving someone a task and @mentioning a
        // colleague all need the same thing: the names of the people on this
        // team. It is a list of colleagues, not a privilege.
        SalesPermissions::enforceAny($request->user, [
            'sales.challenges.create',
            'sales.challenges.manage',
            'sales.leads.assign',
            'sales.tasks.create',
            'sales.comments.create',
        ]);

        // The email comes back with the name because two accounts can answer
        // to the same one. A picker showing "Kaushik" twice will eventually be
        // pointed at the wrong account, and the person it was meant for never
        // sees the challenge or the task at all.
        $rows = Database::fetchAll(
            "SELECT user_id, name, email FROM users
              WHERE tenant_id = ? AND user_type = 'admin' AND is_active = 1
              ORDER BY name ASC",
            [Database::tenantId()]
        );

        Response::success(array_map(fn(array $r): array => [
            'user_id' => (int)$r['user_id'],
            'name'    => $r['name'],
            'email'   => (string)($r['email'] ?? ''),
        ], $rows));
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
                'lockout'     => ($l = SalesLockout::active((int)$row['user_id'])) ? SalesLockout::format($l) : null,
            ];
        }, $rows);

        Response::success($users);
    }

    /**
     * POST /admin/sales/users — create a login for a sales employee.
     *
     * Always stamps an explicit staff_role. That matters: AdminMiddleware treats
     * an admin whose staff_role is NULL as an OWNER (a back-compat rule for
     * accounts that predate the column), so a sales user created without one
     * would silently receive full sales administration rights.
     */
    public function createUser(Request $request): void
    {
        $this->enforceAdmin($request);

        $name  = trim((string)$request->input('name', ''));
        $email = strtolower(trim((string)$request->input('email', '')));
        $phone = preg_replace('/\D/', '', (string)$request->input('phone', ''));
        $pass  = (string)$request->input('password', '');

        if (mb_strlen($name) < 2) {
            Response::error('Name is required', 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('A valid email address is required', 422);
        }
        if (strlen($phone) < 10) {
            Response::error('A valid phone number is required (at least 10 digits)', 422);
        }
        if (strlen($pass) < 8) {
            Response::error('Password must be at least 8 characters', 422);
        }

        $staffRole = AdminMiddleware::normalizeStaffRole($request->input('staff_role', 'sales'));
        if ($staffRole === null) {
            Response::error('Invalid role. Allowed: ' . implode(', ', AdminMiddleware::validStaffRoles()), 422);
        }

        if (!User::hasStaffRoleColumn()) {
            Response::error('The staff_role migration has not been applied on this installation', 500);
        }

        try {
            $userId = User::create([
                'name'      => $name,
                'email'     => $email,
                'phone'     => $phone,
                'user_type' => 'admin',
                'password'  => $pass,
            ]);
        } catch (AppException $e) {
            Response::error($e->getMessage(), $e->getCode() ?: 409);
        }

        Database::execute(
            'UPDATE users SET staff_role = ? WHERE user_id = ? AND tenant_id = ?',
            [$staffRole, $userId, Database::tenantId()]
        );

        // Optional starting permission set, so the account is usable immediately.
        $requested = $request->input('permissions', []);
        if (is_array($requested) && $requested) {
            $this->writeManagedRole($userId, $name, array_values(array_intersect($requested, SalesPermissions::all())));
        }

        $this->audit($request, 'sales_user_created', $userId, ['email' => $email, 'staff_role' => $staffRole]);

        Response::success([
            'user_id'     => $userId,
            'name'        => $name,
            'email'       => $email,
            'staff_role'  => $staffRole,
            'permissions' => $this->effectiveForUser($userId),
        ], 'Sales user created', 201);
    }

    /** PUT /admin/sales/users/{id}/role — change a user's staff role. */
    public function setRole(Request $request): void
    {
        $this->enforceAdmin($request);

        $userId = (int)$request->param('id');
        $target = $this->findAdmin($userId);

        // Guard against locking yourself out of access control.
        if ($userId === (int)($request->user['user_id'] ?? 0)) {
            Response::error('You cannot change your own role', 409);
        }

        $staffRole = AdminMiddleware::normalizeStaffRole($request->input('staff_role'));
        if ($staffRole === null) {
            Response::error('Invalid role. Allowed: ' . implode(', ', AdminMiddleware::validStaffRoles()), 422);
        }
        if (!User::hasStaffRoleColumn()) {
            Response::error('The staff_role migration has not been applied on this installation', 500);
        }

        Database::execute(
            'UPDATE users SET staff_role = ? WHERE user_id = ? AND tenant_id = ?',
            [$staffRole, $userId, Database::tenantId()]
        );

        $this->audit($request, 'sales_user_role_changed', $userId, [
            'from' => $target['staff_role'] ?? null,
            'to'   => $staffRole,
        ]);

        Response::success([
            'user_id'     => $userId,
            'staff_role'  => $staffRole,
            'permissions' => $this->effectiveForUser($userId),
        ], 'Role updated');
    }

    /** PUT /admin/sales/users/{id}/active — enable or disable the login. */
    public function setActive(Request $request): void
    {
        $this->enforceAdmin($request);

        $userId = (int)$request->param('id');
        $this->findAdmin($userId);

        if ($userId === (int)($request->user['user_id'] ?? 0)) {
            Response::error('You cannot deactivate your own account', 409);
        }

        $active = (bool)$request->input('is_active', true);
        Database::execute(
            'UPDATE users SET is_active = ? WHERE user_id = ? AND tenant_id = ?',
            [$active ? 1 : 0, $userId, Database::tenantId()]
        );

        $this->audit($request, 'sales_user_active_changed', $userId, ['is_active' => $active]);

        Response::success(['user_id' => $userId, 'is_active' => $active], $active ? 'Account enabled' : 'Account disabled');
    }

    /**
     * PUT /admin/sales/users/{id}/password
     * body: { password: string }
     *
     * Re-issues the app login for a sales user who has forgotten theirs or was
     * never given one. Existing sessions are left alone — the new password
     * simply becomes what they log in with next time.
     *
     * An admin cannot reset their own password here: doing it from a screen
     * that manages other people is how the wrong account gets locked out. Their
     * own password is changed from account settings.
     */
    public function setPassword(Request $request): void
    {
        $this->enforceAdmin($request);

        $userId = (int)$request->param('id');
        $target = $this->findAdmin($userId);

        if ($userId === (int)($request->user['user_id'] ?? 0)) {
            Response::error('Change your own password from account settings', 409);
        }

        $password = (string)$request->input('password', '');
        if (strlen($password) < 8) {
            Response::error('Password must be at least 8 characters', 422);
        }

        User::updatePassword($userId, $password);
        $this->audit($request, 'sales_user_password_reset', $userId, ['email' => $target['email'] ?? null]);

        Response::success(
            ['user_id' => $userId, 'email' => $target['email'] ?? null],
            'Password updated — share it with the user and ask them to change it'
        );
    }

    /**
     * PUT /admin/sales/users/{id}/permissions
     * body: { permissions: string[] }
     */
    public function setPermissions(Request $request): void
    {
        $this->enforceAdmin($request);

        $userId = (int)$request->param('id');
        $target = $this->findAdmin($userId);

        $requested = $request->input('permissions', []);
        if (!is_array($requested)) {
            Response::error('permissions must be an array', 422);
        }

        // Silently drop anything outside this module's catalogue.
        $permissions = array_values(array_intersect($requested, SalesPermissions::all()));
        $roleId      = $this->writeManagedRole($userId, (string)$target['name'], $permissions);

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

    /** Loads an admin user in this tenant, or aborts with 404. */
    private function findAdmin(int $userId): array
    {
        $row = Database::fetch(
            "SELECT user_id, name, email, is_active"
            . (User::hasStaffRoleColumn() ? ', staff_role' : '') . "
               FROM users WHERE user_id = ? AND tenant_id = ? AND user_type = 'admin' LIMIT 1",
            [$userId, Database::tenantId()]
        );
        if (!$row) {
            Response::error('User not found in this workspace', 404);
        }
        return $row;
    }

    /**
     * Writes the user's sales permissions into ONE managed RBAC role and makes
     * sure it is assigned. Shared by createUser() and setPermissions() so both
     * paths produce exactly the same structure.
     */
    private function writeManagedRole(int $userId, string $name, array $permissions): int
    {
        $tenantId    = Database::tenantId();
        $roleName    = self::MANAGED_ROLE_PREFIX . $name . ' #' . $userId;
        $description = 'Sales module access managed from Admin → Access Control';

        $existing = Database::fetch(
            'SELECT role_id FROM roles WHERE tenant_id = ? AND name = ? LIMIT 1',
            [$tenantId, $roleName]
        );

        if ($existing) {
            $roleId = (int)$existing['role_id'];
            Database::execute(
                'UPDATE roles SET permissions = ?, description = ? WHERE role_id = ? AND tenant_id = ?',
                [json_encode($permissions), $description, $roleId, $tenantId]
            );
        } else {
            $roleId = Database::insert('roles', [
                'tenant_id'   => $tenantId,
                'name'        => $roleName,
                'description' => $description,
                'permissions' => json_encode($permissions),
                'is_system'   => 0,
            ]);
        }

        Database::execute(
            'INSERT IGNORE INTO user_roles (tenant_id, user_id, role_id) VALUES (?, ?, ?)',
            [$tenantId, $userId, $roleId]
        );

        return $roleId;
    }

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
