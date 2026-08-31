<?php
declare(strict_types=1);

/**
 * SalesPermissions — the single source of truth for who may do what inside the
 * Sales module.
 *
 * Layers, in the order the spec requires them to be evaluated:
 *
 *   Authentication  → AuthMiddleware (route guard 'admin')
 *   Role            → AdminMiddleware + staff_role
 *   Permission      → this helper (RBAC roles + staff_role defaults)
 *   Record access   → canAccessLead() / challenge assignment checks
 *   Business action → the controller
 *
 * Frontend visibility is never treated as security: every sales controller
 * calls enforce() before it touches data, so a sales user cannot reach an
 * admin-only action by crafting the request by hand.
 */
class SalesPermissions
{
    /** Catalogue of sales permissions, grouped the way the Access Control UI shows them. */
    public const CATALOG = [
        'Dashboard'  => [
            'sales.dashboard.view',
        ],
        'Leads'      => [
            'sales.leads.view',
            'sales.leads.view_all',
            'sales.leads.create',
            'sales.leads.edit',
            'sales.leads.assign',
            'sales.leads.convert',
        ],
        'Calls'      => [
            'sales.calls.view',
            'sales.calls.create',
        ],
        'Follow-Ups' => [
            'sales.followups.view',
            'sales.followups.create',
            'sales.followups.complete',
        ],
        'Meetings'   => [
            'sales.meetings.view',
            'sales.meetings.create',
            'sales.meetings.edit',
        ],
        'Challenges' => [
            'sales.challenges.view',
            'sales.challenges.accept',
            'sales.challenges.complete',
            'sales.challenges.create',
            'sales.challenges.manage',
        ],
        'Reports'    => [
            'sales.reports.view',
        ],
    ];

    /**
     * Sensible defaults per built-in staff_role so the module is usable before
     * any custom RBAC role is created. Custom roles are additive on top of these.
     * 'owner' is handled separately — it holds every sales permission.
     */
    private const ROLE_DEFAULTS = [
        'sales' => [
            'sales.dashboard.view',
            'sales.leads.view',
            'sales.leads.create',
            'sales.leads.edit',
            'sales.calls.view',
            'sales.calls.create',
            'sales.followups.view',
            'sales.followups.create',
            'sales.followups.complete',
            'sales.meetings.view',
            'sales.meetings.create',
            'sales.meetings.edit',
            'sales.challenges.view',
            'sales.challenges.accept',
            'sales.challenges.complete',
        ],
        // Read-only visibility for roles that need sales context but don't sell.
        'accountant' => ['sales.dashboard.view', 'sales.leads.view', 'sales.leads.view_all', 'sales.reports.view'],
        'hr'         => ['sales.dashboard.view'],
    ];

    /** Permissions only an administrator of the sales module should hold. */
    public const ADMIN_ONLY = [
        'sales.leads.assign',
        'sales.leads.view_all',
        'sales.leads.convert',
        'sales.challenges.create',
        'sales.challenges.manage',
        'sales.reports.view',
    ];

    /** Flat list of every permission this module defines. */
    public static function all(): array
    {
        return array_values(array_merge(...array_values(self::CATALOG)));
    }

    /** True when the user is a full sales administrator (owner staff_role). */
    public static function isAdmin(array $user): bool
    {
        if (($user['user_type'] ?? '') !== 'admin') {
            return false;
        }
        $role = AdminMiddleware::normalizeStaffRole($user['staff_role'] ?? null) ?? 'owner';
        return $role === 'owner';
    }

    /**
     * Every sales permission the user effectively holds:
     * owner → all; otherwise staff_role defaults + permissions from assigned
     * RBAC roles (roles/user_roles), filtered to this module's catalogue.
     */
    public static function forUser(array $user): array
    {
        if (($user['user_type'] ?? '') !== 'admin') {
            return [];
        }

        if (self::isAdmin($user)) {
            return self::all();
        }

        $role  = AdminMiddleware::normalizeStaffRole($user['staff_role'] ?? null) ?? '';
        $perms = self::ROLE_DEFAULTS[$role] ?? [];

        $userId = isset($user['user_id']) ? (int)$user['user_id'] : 0;
        if ($userId > 0) {
            try {
                $granted = Role::permissionsForUser($userId);
                $perms   = array_merge($perms, array_intersect($granted, self::all()));
            } catch (Throwable $e) {
                // RBAC tables missing on an older install — fall back to role defaults.
                error_log('[SalesPermissions] role lookup failed: ' . $e->getMessage());
            }
        }

        return array_values(array_unique($perms));
    }

    public static function has(array $user, string $permission): bool
    {
        return in_array($permission, self::forUser($user), true);
    }

    /** Aborts with 403 unless the user holds the permission. */
    public static function enforce(?array $user, string $permission): void
    {
        if ($user === null || !self::has($user, $permission)) {
            self::auditDenied($user, $permission);
            Response::error('You do not have permission to perform this action', 403);
        }
    }

    /** Aborts with 403 unless the user holds at least one of the permissions. */
    public static function enforceAny(?array $user, array $permissions): void
    {
        if ($user === null) {
            Response::error('You do not have permission to perform this action', 403);
        }
        $held = self::forUser($user);
        foreach ($permissions as $p) {
            if (in_array($p, $held, true)) {
                return;
            }
        }
        self::auditDenied($user, implode('|', $permissions));
        Response::error('You do not have permission to perform this action', 403);
    }

    /**
     * Record-level access: a sales user only reaches leads assigned to them
     * unless they hold sales.leads.view_all (admins always do).
     */
    public static function canSeeAllLeads(array $user): bool
    {
        return self::has($user, 'sales.leads.view_all');
    }

    /**
     * SQL fragment + params restricting a lead query to what the user may see.
     * Returns ['sql' => string, 'params' => array]; sql is '' when unrestricted.
     */
    public static function leadScope(array $user, string $column = 'assigned_to'): array
    {
        if (self::canSeeAllLeads($user)) {
            return ['sql' => '', 'params' => []];
        }
        return [
            'sql'    => " AND $column = ?",
            'params' => [isset($user['user_id']) ? (int)$user['user_id'] : 0],
        ];
    }

    /** Aborts with 404 (not 403 — don't leak existence) when the lead is out of scope. */
    public static function assertLeadAccess(array $user, array $lead): void
    {
        if (self::canSeeAllLeads($user)) {
            return;
        }
        $userId = isset($user['user_id']) ? (int)$user['user_id'] : 0;
        if ((int)($lead['assigned_to'] ?? 0) !== $userId) {
            Response::error('Lead not found', 404);
        }
    }

    private static function auditDenied(?array $user, string $permission): void
    {
        try {
            Database::execute(
                'INSERT INTO audit_log (tenant_id, user_id, action, table_name, old_value, new_value, ip_address, created_at)
                 VALUES (?, ?, ?, ?, NULL, ?, NULL, NOW())',
                [
                    Database::tenantId(),
                    isset($user['user_id']) ? (int)$user['user_id'] : null,
                    'permission_denied',
                    'sales',
                    json_encode(['permission' => $permission]),
                ]
            );
        } catch (Throwable $e) {
            error_log('[SalesPermissions] denial audit failed: ' . $e->getMessage());
        }
    }
}
