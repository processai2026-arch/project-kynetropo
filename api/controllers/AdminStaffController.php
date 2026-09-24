<?php
declare(strict_types=1);

/**
 * Admin Staff Controller — Invoice module sub-user management
 * GET  /admin/staff-users              — list staff users for this tenant
 * POST /admin/staff-users              — create staff account
 * PUT  /admin/staff-users/{id}         — update staff account
 * DELETE /admin/staff-users/{id}       — remove staff account
 * GET  /admin/staff-users/roles/list   — list all roles
 * POST /admin/staff-users/roles/add    — add a custom role
 *
 * Staff users are stored in the main `users` table with user_type='staff'
 * and a JSON `permissions` column storing which modules they can access.
 * Roles are stored in settings table as key=staff_roles, value=JSON array.
 */
class AdminStaffController
{
    private const DEFAULT_ROLES = ['admin','manager','accountant','staff','viewer'];

    private const ROLE_PRESETS = [
        'admin'      => ['invoices','inventory','purchases','sales','gst','reports','customers','settings','bank_statement','commission','damaged_goods','users'],
        'manager'    => ['invoices','inventory','purchases','sales','reports','customers','commission'],
        'accountant' => ['invoices','gst','reports','bank_statement','commission'],
        'staff'      => ['invoices','inventory','sales'],
        'viewer'     => ['invoices','sales','reports'],
    ];

    // ─── GET /admin/staff-users ───────────────────────────────────────────────
    public function index(Request $request): void
    {
        $tid  = Database::tenantId();
        $rows = Database::fetchAll(
            'SELECT user_id AS id, name, email, user_type AS role, permissions, created_at
             FROM users WHERE tenant_id = ? AND user_type != "owner"
             ORDER BY name ASC',
            [$tid]
        );
        foreach ($rows as &$r) {
            if ($r['permissions']) {
                $decoded = json_decode((string)$r['permissions'], true);
                $r['permissions'] = is_array($decoded) ? $decoded : self::ROLE_PRESETS[$r['role']] ?? [];
            } else {
                $r['permissions'] = self::ROLE_PRESETS[$r['role']] ?? [];
            }
        }
        Response::success(['data' => $rows, 'total' => count($rows)]);
    }

    // ─── POST /admin/staff-users ──────────────────────────────────────────────
    public function store(Request $request): void
    {
        $tid   = Database::tenantId();
        $name  = trim((string)($request->input('name') ?? ''));
        $email = strtolower(trim((string)($request->input('email') ?? '')));
        $role  = $request->input('role') ?: 'staff';
        $pwd   = (string)($request->input('password') ?? '');
        $perms = $request->input('permissions') ?? self::ROLE_PRESETS[$role] ?? [];

        if ($name === '') Response::error('name is required', 422);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) Response::error('Valid email is required', 422);
        if (strlen($pwd) < 8) Response::error('Password must be at least 8 characters', 422);
        if (!is_array($perms)) $perms = self::ROLE_PRESETS[$role] ?? [];

        // Check email not already taken
        if (Database::fetch('SELECT user_id FROM users WHERE email = ? LIMIT 1', [$email])) {
            Response::error('This email is already registered', 409);
        }

        $hash = password_hash($pwd, PASSWORD_BCRYPT, ['cost' => 12]);
        $id   = Database::insert(
            'INSERT INTO users (tenant_id, name, email, password_hash, user_type, permissions, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, NOW())',
            [$tid, Request::sanitize($name), $email, $hash, $role, json_encode(array_values($perms))]
        );

        $user = Database::fetch('SELECT user_id AS id, name, email, user_type AS role, permissions, created_at FROM users WHERE user_id = ? LIMIT 1', [$id]);
        $user['permissions'] = json_decode((string)$user['permissions'], true) ?? [];
        Response::success($user, 'Staff user created', 201);
    }

    // ─── PUT /admin/staff-users/{id} ─────────────────────────────────────────
    public function update(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $existing = Database::fetch('SELECT user_id, user_type FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1', [$id, $tid]);
        if (!$existing) Response::error('Staff user not found', 404);
        if ($existing['user_type'] === 'owner') Response::error('Cannot modify owner account', 403);

        $sets   = [];
        $params = [];

        if ($name = trim((string)($request->input('name') ?? ''))) {
            $sets[] = 'name = ?'; $params[] = Request::sanitize($name);
        }
        if ($role = $request->input('role')) {
            $sets[] = 'user_type = ?'; $params[] = $role;
        }
        if ($perms = $request->input('permissions')) {
            if (is_array($perms)) { $sets[] = 'permissions = ?'; $params[] = json_encode(array_values($perms)); }
        }
        if ($pwd = $request->input('password')) {
            if (strlen($pwd) < 8) Response::error('Password must be at least 8 characters', 422);
            $sets[] = 'password_hash = ?'; $params[] = password_hash($pwd, PASSWORD_BCRYPT, ['cost' => 12]);
        }

        if (empty($sets)) Response::error('No fields to update', 400);
        $params[] = $id; $params[] = $tid;
        Database::execute('UPDATE users SET ' . implode(', ', $sets) . ', updated_at = NOW() WHERE user_id = ? AND tenant_id = ?', $params);

        $user = Database::fetch('SELECT user_id AS id, name, email, user_type AS role, permissions, created_at FROM users WHERE user_id = ? LIMIT 1', [$id]);
        $user['permissions'] = json_decode((string)$user['permissions'], true) ?? [];
        Response::success($user, 'Staff user updated');
    }

    // ─── DELETE /admin/staff-users/{id} ──────────────────────────────────────
    public function destroy(Request $request): void
    {
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $existing = Database::fetch('SELECT user_id, user_type FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1', [$id, $tid]);
        if (!$existing) Response::error('Staff user not found', 404);
        if ($existing['user_type'] === 'owner') Response::error('Cannot delete owner account', 403);
        Database::execute('DELETE FROM users WHERE user_id = ? AND tenant_id = ?', [$id, $tid]);
        Response::success(null, 'Staff user removed');
    }

    // ─── GET /admin/staff-users/roles/list ───────────────────────────────────
    public function rolesList(Request $request): void
    {
        $tid     = Database::tenantId();
        $setting = Database::fetch('SELECT setting_value FROM settings WHERE setting_key = ? AND tenant_id = ? LIMIT 1', ['staff_custom_roles', $tid]);
        $custom  = $setting ? (json_decode((string)$setting['setting_value'], true) ?? []) : [];
        $all     = array_values(array_unique(array_merge(self::DEFAULT_ROLES, $custom)));
        Response::success($all);
    }

    // ─── POST /admin/staff-users/roles/add ───────────────────────────────────
    public function rolesAdd(Request $request): void
    {
        $tid  = Database::tenantId();
        $role = strtolower(trim(preg_replace('/\s+/', '_', (string)($request->input('role') ?? ''))));
        if (!$role || !preg_match('/^[a-z_]{2,30}$/', $role)) Response::error('Invalid role name', 422);
        if (in_array($role, self::DEFAULT_ROLES, true)) Response::error('Role already exists', 409);

        $setting = Database::fetch('SELECT setting_value FROM settings WHERE setting_key = ? AND tenant_id = ? LIMIT 1', ['staff_custom_roles', $tid]);
        $current = $setting ? (json_decode((string)$setting['setting_value'], true) ?? []) : [];
        if (in_array($role, $current, true)) Response::error('Role already exists', 409);

        $updated = json_encode(array_values(array_unique([...$current, $role])));
        if ($setting) {
            Database::execute('UPDATE settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ? AND tenant_id = ?', [$updated, 'staff_custom_roles', $tid]);
        } else {
            Database::insert('INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES (?, ?, ?)', [$tid, 'staff_custom_roles', $updated]);
        }
        Response::success(['role' => $role], 'Role added', 201);
    }
}
