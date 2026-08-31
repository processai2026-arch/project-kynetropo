<?php
declare(strict_types=1);

/**
 * PlatformDB — connection to the CONTROL-PLANE database.
 *
 * This is the SaaS management database (tenants, plans, subscriptions, billing).
 * It is SEPARATE from the tenant business-data connection (see Database.php).
 * Used by: tenant resolution, signup, billing, the super-admin panel.
 *
 * Mirrors the Database helper API (fetch/fetchAll/insert/execute/count) but
 * always against the control plane.
 */
class PlatformDB
{
    private static ?PDO $instance = null;

    private function __construct() {}

    public static function getInstance(): PDO
    {
        if (self::$instance === null) {
            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                CP_DB_HOST, CP_DB_PORT, CP_DB_NAME
            );
            try {
                $pdo = new PDO($dsn, CP_DB_USER, CP_DB_PASS, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '+05:30'",
                ]);
                $pdo->exec("SET SESSION sql_mode = TRIM(BOTH ',' FROM REPLACE(REPLACE(REPLACE(@@SESSION.sql_mode,'ONLY_FULL_GROUP_BY',''),',,',','),' ',''))");
                self::$instance = $pdo;
            } catch (PDOException $e) {
                error_log('[PlatformDB] Connection failed: ' . $e->getMessage());
                Response::error('Platform database unavailable', 503);
            }
        }
        return self::$instance;
    }

    public static function fetch(string $sql, array $params = []): ?array
    {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetch() ?: null;
    }

    public static function fetchAll(string $sql, array $params = []): array
    {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function insert(string $sql, array $params = []): int
    {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return (int) self::getInstance()->lastInsertId();
    }

    public static function execute(string $sql, array $params = []): int
    {
        $stmt = self::getInstance()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }
}
