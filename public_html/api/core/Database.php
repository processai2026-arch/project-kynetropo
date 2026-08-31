<?php
declare(strict_types=1);

class Database
{
    /**
     * Tenant-aware connection cache, keyed by connection signature.
     * 'shared' → the default shared app DB (config/database.php).
     * 'dedicated:{host}:{name}' → a split-out tenant's own DB (from tenant_connections).
     */
    private static array $pool = [];

    private function __construct() {}
    private function __clone() {}

    /**
     * Returns the PDO for the CURRENT tenant's business data.
     * Falls back to the shared DB when there is no tenant context yet
     * (e.g. control-plane/bootstrap code) or the tenant lives on the shared DB.
     */
    public static function getInstance(): PDO
    {
        $conn = (class_exists('TenantContext') && TenantContext::has())
            ? TenantContext::connection()
            : ['shared' => true];

        if (!empty($conn['shared'])) {
            return self::$pool['shared'] ??= self::connect(DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS);
        }

        $key = 'dedicated:' . $conn['host'] . ':' . $conn['name'];
        return self::$pool[$key] ??= self::connect($conn['host'], $conn['port'], $conn['name'], $conn['user'], $conn['pass']);
    }

    private static function connect(string $host, int $port, string $name, string $user, string $pass): PDO
    {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, defined('DB_CHARSET') ? DB_CHARSET : 'utf8mb4');
        try {
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '+05:30'",
            ]);
            $pdo->exec("SET SESSION sql_mode = TRIM(BOTH ',' FROM REPLACE(REPLACE(REPLACE(@@SESSION.sql_mode,'ONLY_FULL_GROUP_BY',''),',,',','),' ',''))");
            return $pdo;
        } catch (PDOException $e) {
            error_log('[DB] Connection failed: ' . $e->getMessage());
            Response::error('Database connection failed', 503);
        }
    }

    /**
     * Tenant-scoping guard for the SHARED DB model. Returns the tenant_id that
     * app queries on shared tables MUST include in their WHERE clause. On a
     * dedicated-DB tenant this still returns the id (harmless; data is already
     * physically isolated). See docs/01-ROADMAP.md "Tenant scoping".
     */
    public static function tenantId(): int
    {
        // When TENANCY_ENABLED=false (single-tenant mode), skip TenantContext entirely.
        // Without this check, every API call fails with "No tenant context" even when
        // tenancy is disabled — because TenantContext::requireId() always throws.
        if (defined('TENANCY_ENABLED') && !TENANCY_ENABLED) {
            return defined('FOUNDING_TENANT_ID') ? (int)FOUNDING_TENANT_ID : 1;
        }
        return TenantContext::requireId();
    }

    public static function query(string $sql, array $params = []): PDOStatement
    {
        if (class_exists('TenantScope')) {
            TenantScope::audit($sql); // dev tripwire: flags unscoped tenant-table queries
        }
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /**
     * Tenant-safe INSERT helper. Auto-stamps tenant_id from the current context
     * (when tenancy is enabled) so callers can't forget it. Column names must be
     * trusted (code-controlled), values are bound. Returns the new row id.
     *
     *   Database::insertTenant('vendors', ['name' => $name, 'gstin' => $gstin]);
     */
    public static function insertTenant(string $table, array $data): int
    {
        if (defined('TENANCY_ENABLED') && TENANCY_ENABLED && !isset($data['tenant_id'])) {
            $data = ['tenant_id' => self::tenantId()] + $data;
        }
        $cols = array_keys($data);
        $place = implode(', ', array_fill(0, count($cols), '?'));
        $colList = '`' . implode('`, `', $cols) . '`';
        self::query("INSERT INTO `$table` ($colList) VALUES ($place)", array_values($data));
        return (int) self::getInstance()->lastInsertId();
    }

    public static function fetch(string $sql, array $params = []): ?array
    {
        $row = self::query($sql, $params)->fetch();
        return $row ?: null;
    }

    public static function fetchAll(string $sql, array $params = []): array
    {
        return self::query($sql, $params)->fetchAll();
    }

    public static function insert(string $tableOrSql, array $params = []): int
    {
        // If called as insert('table_name', ['col' => val, ...]) — convenience helper
        if (!str_contains(strtoupper($tableOrSql), ' ')) {
            $table = $tableOrSql;
            $data  = $params;
            $cols  = array_keys($data);
            $place = implode(', ', array_fill(0, count($cols), '?'));
            $colList = '`' . implode('`, `', $cols) . '`';
            self::query("INSERT INTO `$table` ($colList) VALUES ($place)", array_values($data));
            return (int) self::getInstance()->lastInsertId();
        }
        // Legacy: insert(raw SQL, params)
        self::query($tableOrSql, $params);
        return (int) self::getInstance()->lastInsertId();
    }

    /**
     * UPDATE helper: update('table', ['col' => val], ['id' => 1, 'tenant_id' => 2])
     */
    public static function update(string $table, array $data, array $where): int
    {
        if (empty($data) || empty($where)) return 0;
        $set   = implode(', ', array_map(fn($c) => "`$c` = ?", array_keys($data)));
        $cond  = implode(' AND ', array_map(fn($c) => "`$c` = ?", array_keys($where)));
        $params = array_merge(array_values($data), array_values($where));
        return self::query("UPDATE `$table` SET $set WHERE $cond", $params)->rowCount();
    }

    public static function execute(string $sql, array $params = []): int
    {
        return self::query($sql, $params)->rowCount();
    }

    public static function count(string $sql, array $params = []): int
    {
        $row = self::fetch($sql, $params);
        return (int)($row['cnt'] ?? 0);
    }

    public static function beginTransaction(): void
    {
        self::getInstance()->beginTransaction();
    }

    public static function commit(): void
    {
        self::getInstance()->commit();
    }

    public static function rollBack(): void
    {
        self::getInstance()->rollBack();
    }
}
