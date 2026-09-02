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
        'Tasks'      => [
            'sales.tasks.view',
            'sales.tasks.create',
            'sales.tasks.complete',
            'sales.tasks.manage',
        ],
        'Comments'   => [
            'sales.comments.view',
            'sales.comments.create',
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
            // The team works one pipeline: everybody can see every lead, and
            // the owner filter on the Leads page is how you narrow it to one
            // person. Editing is still governed separately — seeing a
            // colleague's lead is not the same as being able to change it.
            'sales.leads.view_all',
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
            'sales.tasks.view',
            'sales.tasks.create',
            'sales.tasks.complete',
            'sales.comments.view',
            'sales.comments.create',
        ],
        // Read-only visibility for roles that need sales context but don't sell.
        'accountant' => ['sales.dashboard.view', 'sales.leads.view', 'sales.leads.view_all', 'sales.reports.view',
                         'sales.comments.view'],
        'hr'         => ['sales.dashboard.view'],
    ];

    /** Permissions only an administrator of the sales module should hold. */
    public const ADMIN_ONLY = [
        'sales.leads.assign',
        'sales.leads.convert',
        'sales.challenges.create',
        'sales.challenges.manage',
        'sales.tasks.manage',
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

    /**
     * Aborts with 423 when the user lost a challenge and their app access was
     * destroyed. Checked before the permission itself, so a locked-out user
     * gets the real reason rather than a misleading "no permission".
     *
     * GET /admin/sales/me deliberately does NOT call this — the app has to be
     * able to load enough to show the destruction screen.
     */
    public static function assertNotLocked(?array $user): void
    {
        $userId = isset($user['user_id']) ? (int)$user['user_id'] : 0;
        if ($userId < 1) {
            return;
        }
        $lockout = SalesLockout::active($userId);
        if ($lockout === null) {
            return;
        }
        Response::error(
            'Your sales app access was destroyed after a missed challenge. Contact your Kynetropo administrator.',
            423
        );
    }

    /** Aborts with 403 unless the user holds the permission. */
    public static function enforce(?array $user, string $permission): void
    {
        SalesViewAs::assertNotWriting();
        self::assertNotLocked($user);
        if ($user === null || !self::has($user, $permission)) {
            self::auditDenied($user, $permission);
            Response::error('You do not have permission to perform this action', 403);
        }
    }

    /** Aborts with 403 unless the user holds at least one of the permissions. */
    public static function enforceAny(?array $user, array $permissions): void
    {
        SalesViewAs::assertNotWriting();
        self::assertNotLocked($user);
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
     * Record-level access.
     *
     * sales.leads.view_all is part of the sales role by default, so in practice
     * the whole team reads the whole pipeline. The permission is kept rather
     * than removed because revoking it is the only way back to a per-owner
     * book, and that decision belongs to whoever runs the team.
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
        // Looking at a colleague narrows everything to THEIR records —
        // deliberately not "everything they are allowed to see", which for an
        // administrator would be the whole team and would make the switch
        // meaningless. The question being asked is "what is Naresh working
        // on?", not "what could Naresh open?".
        $viewing = SalesViewAs::current();
        if ($viewing !== null) {
            return ['sql' => " AND $column = ?", 'params' => [(int)$viewing['user_id']]];
        }

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
        // While viewing a colleague, their pipeline is the whole world — a lead
        // outside it is out of view even for an administrator, so the list and
        // the detail page agree about what is in this person's book.
        $viewing = SalesViewAs::current();
        if ($viewing !== null) {
            if ((int)($lead['assigned_to'] ?? 0) !== (int)$viewing['user_id']) {
                Response::error('Lead not found', 404);
            }
            return;
        }

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
