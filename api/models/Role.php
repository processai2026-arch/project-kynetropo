<?php
declare(strict_types=1);

/**
 * RBAC Role — a tenant-defined set of granular permissions assignable to admin
 * users (in addition to the built-in staff_role). Tenant-scoped.
 */
class Role
{
    /** Catalogue of assignable permissions, grouped for the UI. */
    public const CATALOG = [
        'sales'      => ['sales.view', 'sales.manage', 'invoices.manage', 'payments.manage'],
        'crm'        => ['crm.view', 'crm.manage'],
        'inventory'  => ['inventory.view', 'inventory.manage', 'inventory.transfer'],
        'procurement'=> ['procurement.view', 'procurement.manage', 'bills.approve'],
        'finance'    => ['finance.view', 'accounting.manage', 'expenses.approve'],
        'hr'         => ['hr.view', 'hr.manage', 'payroll.run', 'leave.approve'],
        'admin'      => ['users.manage', 'roles.manage', 'settings.manage', 'audit.view'],
    ];

    /**
     * The permission catalogue shown in Access Control. The Sales module keeps
     * its own catalogue in SalesPermissions so the two stay in one place each;
     * it is merged in here (rather than duplicated) so a role can carry sales
     * permissions and survive an edit through the generic RBAC screen.
     */
    public static function catalog(): array
    {
        $catalog = self::CATALOG;
        if (class_exists('SalesPermissions')) {
            foreach (SalesPermissions::CATALOG as $group => $permissions) {
                $catalog['sales: ' . strtolower($group)] = $permissions;
            }
        }
        return $catalog;
    }

    public static function allPermissions(): array
    {
        return array_values(array_merge(...array_values(self::catalog())));
    }

    public static function all(): array
    {
        $rows = Database::fetchAll(
            'SELECT role_id, name, description, permissions, is_system, created_at
             FROM roles WHERE tenant_id = ? ORDER BY name ASC',
            [Database::tenantId()]
        );
        foreach ($rows as &$r) {
            $r['permissions'] = $r['permissions'] ? (json_decode((string)$r['permissions'], true) ?: []) : [];
            $r['is_system'] = (bool)$r['is_system'];
        }
        return $rows;
    }

    public static function findById(int $id): ?array
    {
        $row = Database::fetch(
            'SELECT * FROM roles WHERE role_id = ? AND tenant_id = ? LIMIT 1',
            [$id, Database::tenantId()]
        );
        if (!$row) return null;
        $row['permissions'] = $row['permissions'] ? (json_decode((string)$row['permissions'], true) ?: []) : [];
        $row['is_system'] = (bool)$row['is_system'];
        return $row;
    }

    public static function create(string $name, ?string $description, array $permissions): int
    {
        return Database::insertTenant('roles', [
            'name'        => $name,
            'description' => $description,
            'permissions' => json_encode(self::sanitize($permissions)),
            'is_system'   => 0,
        ]);
    }

    public static function update(int $id, array $fields): void
    {
        $sets = [];
        $params = [];
        if (isset($fields['name']))        { $sets[] = 'name = ?';        $params[] = $fields['name']; }
        if (isset($fields['description'])) { $sets[] = 'description = ?'; $params[] = $fields['description']; }
        if (isset($fields['permissions'])) { $sets[] = 'permissions = ?'; $params[] = json_encode(self::sanitize($fields['permissions'])); }
        if (!$sets) return;
        $params[] = $id;
        $params[] = Database::tenantId();
        Database::execute('UPDATE roles SET ' . implode(', ', $sets) . ' WHERE role_id = ? AND tenant_id = ?', $params);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM user_roles WHERE role_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        Database::execute('DELETE FROM roles WHERE role_id = ? AND tenant_id = ? AND is_system = 0', [$id, Database::tenantId()]);
    }

    public static function assign(int $userId, int $roleId): void
    {
        Database::execute(
            'INSERT IGNORE INTO user_roles (tenant_id, user_id, role_id) VALUES (?, ?, ?)',
            [Database::tenantId(), $userId, $roleId]
        );
    }

    public static function unassign(int $userId, int $roleId): void
    {
        Database::execute(
            'DELETE FROM user_roles WHERE tenant_id = ? AND user_id = ? AND role_id = ?',
            [Database::tenantId(), $userId, $roleId]
        );
    }

    public static function rolesForUser(int $userId): array
    {
        return Database::fetchAll(
            'SELECT r.role_id, r.name, r.permissions FROM user_roles ur
             JOIN roles r ON r.role_id = ur.role_id AND r.tenant_id = ur.tenant_id
             WHERE ur.tenant_id = ? AND ur.user_id = ?',
            [Database::tenantId(), $userId]
        );
    }

    /** Flattened set of permissions a user has across all assigned roles. */
    public static function permissionsForUser(int $userId): array
    {
        $perms = [];
        foreach (self::rolesForUser($userId) as $r) {
            $p = $r['permissions'] ? (json_decode((string)$r['permissions'], true) ?: []) : [];
            $perms = array_merge($perms, $p);
        }
        return array_values(array_unique($perms));
    }

    private static function sanitize(array $permissions): array
    {
        $valid = self::allPermissions();
        return array_values(array_intersect($permissions, $valid));
    }
}
