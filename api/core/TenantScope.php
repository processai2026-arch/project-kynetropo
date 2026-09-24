<?php
declare(strict_types=1);

/**
 * TenantScope — the safety net for shared-DB tenant isolation.
 *
 * In the hybrid model every business table carries a `tenant_id` and EVERY query
 * on a shared-DB tenant table must filter by it. There is no ORM here (queries
 * are hand-written SQL), so isolation can't be auto-injected — it is added per
 * query during the Phase 2 refactor. This class is the tripwire that guarantees
 * none are missed:
 *
 *   • isTenantTable($t)  — is $t a tenant-scoped table? (auto-detected: any table
 *                          that has a `tenant_id` column).
 *   • audit($sql)        — called for every Database query in dev. If the SQL
 *                          touches a tenant table but never mentions `tenant_id`,
 *                          it logs a loud warning (or throws when TENANCY_STRICT).
 *
 * Production never audits (zero overhead). The auditor is intentionally simple
 * (regex, not a SQL parser): it is a developer tripwire, not a security boundary.
 * The real boundary is the per-query `WHERE tenant_id = ?` itself.
 */
class TenantScope
{
    /** @var array<string,bool>|null cache of tenant-scoped table names */
    private static ?array $tenantTables = null;
    private static bool $inDetection = false;

    /**
     * Tables that are global by design (NOT tenant-scoped) even if they ever
     * gain a tenant_id. Auth/infra plumbing and the control-plane tables.
     */
    private const GLOBAL_TABLES = [
        'plans', 'tenants', 'tenant_connections', 'subscriptions',
        'billing_invoices', 'billing_payments', 'platform_admins', 'platform_audit',
        'migrations', 'schema_migrations',
    ];

    /** Discover tenant tables once: any base table that has a `tenant_id` column. */
    private static function load(): array
    {
        if (self::$tenantTables !== null) {
            return self::$tenantTables;
        }
        self::$tenantTables = [];
        self::$inDetection = true;
        try {
            // Direct PDO (NOT Database::query) so the auditor never recurses.
            $stmt = Database::getInstance()->query(
                "SELECT TABLE_NAME FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'tenant_id'"
            );
            foreach ($stmt->fetchAll() as $r) {
                $t = strtolower((string)($r['TABLE_NAME'] ?? ''));
                if ($t !== '' && !in_array($t, self::GLOBAL_TABLES, true)) {
                    self::$tenantTables[$t] = true;
                }
            }
        } catch (\Throwable $e) {
            error_log('[TenantScope] table detection failed: ' . $e->getMessage());
        } finally {
            self::$inDetection = false;
        }
        return self::$tenantTables;
    }

    public static function isTenantTable(string $table): bool
    {
        return isset(self::load()[strtolower(trim($table, " `\""))]);
    }

    /** Forget the cached table set (tests / after migrations). */
    public static function reset(): void
    {
        self::$tenantTables = null;
    }

    /**
     * Dev tripwire. Returns immediately in production, during detection, or when
     * tenancy is off / no tenant is bound. Otherwise warns when a tenant table is
     * referenced without a tenant_id predicate.
     */
    public static function audit(string $sql): void
    {
        if (self::$inDetection) return;
        if (defined('APP_ENV') && APP_ENV === 'production') return;
        if (!defined('TENANCY_ENABLED') || !TENANCY_ENABLED) return;
        if (!class_exists('TenantContext') || !TenantContext::has()) return;

        // Ignore the harmless ones outright.
        $trimmed = ltrim($sql);
        if (preg_match('/^\s*(SET|SHOW|BEGIN|COMMIT|ROLLBACK|START|EXPLAIN|PRAGMA)\b/i', $trimmed)) {
            return;
        }

        $tables = self::tablesIn($sql);
        if (!$tables) return;

        $mentionsTenant = stripos($sql, 'tenant_id') !== false;
        if ($mentionsTenant) return;

        foreach ($tables as $t) {
            if (self::isTenantTable($t)) {
                $msg = "[TenantScope] UNSCOPED query on tenant table `$t` (no tenant_id): "
                     . self::short($sql);
                if (defined('TENANCY_STRICT') && TENANCY_STRICT) {
                    throw new RuntimeException($msg);
                }
                error_log($msg);
                return; // one warning per query is enough
            }
        }
    }

    /** Extract table names following FROM / JOIN / UPDATE / INTO / DELETE FROM. */
    private static function tablesIn(string $sql): array
    {
        $found = [];
        if (preg_match_all(
            '/\b(?:FROM|JOIN|UPDATE|INTO|DELETE\s+FROM)\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i',
            $sql,
            $m
        )) {
            foreach ($m[1] as $t) {
                $found[strtolower($t)] = true;
            }
        }
        return array_keys($found);
    }

    private static function short(string $sql): string
    {
        $s = preg_replace('/\s+/', ' ', trim($sql));
        return strlen($s) > 160 ? substr($s, 0, 160) . '…' : $s;
    }
}
