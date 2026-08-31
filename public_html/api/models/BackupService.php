<?php
declare(strict_types=1);

class BackupService
{
    public static function run(?int $actorId): array
    {
        // insertTenant() auto-stamps tenant_id from the current context.
        $backupId = Database::insertTenant('backup_runs', [
            'backup_type' => 'database',
            'status'      => 'running',
            'created_by'  => $actorId,
            'started_at'  => date('Y-m-d H:i:s'),
        ]);

        $relativePath = null;
        try {
            $relativePath = self::createDatabaseDump($backupId);
            $fullPath = ROOT_PATH . '/' . $relativePath;
            Database::execute(
                'UPDATE backup_runs
                 SET file_path = ?, size_bytes = ?, status = "completed", finished_at = NOW()
                 WHERE backup_id = ? AND tenant_id = ?',
                [$relativePath, is_file($fullPath) ? filesize($fullPath) : 0, $backupId, Database::tenantId()]
            );
            self::cleanupRetention();
            self::audit($actorId, 'backup_completed', 'backup_runs', $backupId, null, ['file_path' => $relativePath]);
        } catch (Throwable $e) {
            Database::execute(
                'UPDATE backup_runs SET status = "failed", error_text = ?, finished_at = NOW() WHERE backup_id = ? AND tenant_id = ?',
                [substr($e->getMessage(), 0, 500), $backupId, Database::tenantId()]
            );
            error_log('Backup failed: ' . $e->getMessage());
            Response::error('Backup failed', 500);
        }

        return self::find($backupId);
    }

    public static function status(): array
    {
        $latest = Database::fetch('SELECT * FROM backup_runs WHERE tenant_id = ? ORDER BY started_at DESC, backup_id DESC LIMIT 1', [Database::tenantId()]);
        $staleHours = self::settingInt('backup_stale_hours', 24);
        $isStale = true;
        if ($latest && $latest['status'] === 'completed' && !empty($latest['finished_at'])) {
            $ageSeconds = time() - strtotime((string)$latest['finished_at']);
            $isStale = $ageSeconds > ($staleHours * 3600);
        }

        $history = Database::fetchAll(
            'SELECT * FROM backup_runs WHERE tenant_id = ? ORDER BY started_at DESC, backup_id DESC LIMIT 20',
            [Database::tenantId()]
        );

        return [
            'latest' => $latest ? self::format($latest) : null,
            'is_stale' => $isStale,
            'stale_after_hours' => $staleHours,
            'backup_directory' => 'backups/',
            'history' => array_map([self::class, 'format'], $history),
        ];
    }

    private static function createDatabaseDump(int $backupId): string
    {
        $directory = ROOT_PATH . '/backups';
        if (!is_dir($directory) && !mkdir($directory, 0750, true)) {
            throw new RuntimeException('Could not create backup directory');
        }

        $filename = 'db-backup-' . date('Ymd-His') . '-' . $backupId . '.sql.gz';
        $path = $directory . '/' . $filename;
        $gz = gzopen($path, 'wb9');
        if (!$gz) {
            throw new RuntimeException('Could not open backup file');
        }

        gzwrite($gz, "-- Database backup\n");
        gzwrite($gz, '-- Generated at ' . date('c') . "\n\n");
        gzwrite($gz, "SET FOREIGN_KEY_CHECKS=0;\n\n");

        // Per-tenant logical backup: only tenant-scoped tables and the current
        // tenant's rows are exported for restore into the existing shared schema.
        foreach (self::tables() as $table) {
            self::writeTable($gz, $table);
        }

        gzwrite($gz, "SET FOREIGN_KEY_CHECKS=1;\n");
        gzclose($gz);
        chmod($path, 0640);

        return 'backups/' . $filename;
    }

    private static function tables(): array
    {
        $rows = Database::fetchAll("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
        $tables = [];
        foreach ($rows as $row) {
            $values = array_values($row);
            if (!empty($values[0])) {
                $tables[] = (string)$values[0];
            }
        }
        sort($tables);
        return $tables;
    }

    private static function writeTable($gz, string $table): void
    {
        $quotedTable = self::quoteIdent($table);
        $tenantColumn = Database::fetch("SHOW COLUMNS FROM {$quotedTable} LIKE 'tenant_id'");
        if (!$tenantColumn) {
            return;
        }

        $createRow = Database::fetch("SHOW CREATE TABLE {$quotedTable}");
        $createValues = $createRow ? array_values($createRow) : [];
        $createSql = $createValues[1] ?? null;
        if (!$createSql) {
            return;
        }
        $createSql = preg_replace('/^CREATE TABLE\s+/i', 'CREATE TABLE IF NOT EXISTS ', $createSql, 1);

        gzwrite($gz, "--\n-- Table {$table}\n--\n");
        gzwrite($gz, $createSql . ";\n\n");

        $pdo = Database::getInstance();
        $stmt = $pdo->prepare("SELECT * FROM {$quotedTable} WHERE `tenant_id` = ?");
        $stmt->execute([Database::tenantId()]);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $columns = array_map([self::class, 'quoteIdent'], array_keys($row));
            $values = [];
            foreach ($row as $value) {
                $values[] = $value === null ? 'NULL' : $pdo->quote((string)$value);
            }
            gzwrite(
                $gz,
                'INSERT INTO ' . $quotedTable . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $values) . ");\n"
            );
        }
        gzwrite($gz, "\n");
    }

    private static function cleanupRetention(): void
    {
        $days = self::settingInt('backup_retention_days', 14);
        $cutoff = date('Y-m-d H:i:s', strtotime("-{$days} days"));
        $oldRows = Database::fetchAll(
            'SELECT * FROM backup_runs WHERE tenant_id = ? AND status = "completed" AND finished_at < ? ORDER BY finished_at ASC',
            [Database::tenantId(), $cutoff]
        );
        foreach ($oldRows as $row) {
            $path = ROOT_PATH . '/' . ltrim((string)($row['file_path'] ?? ''), '/');
            if (is_file($path) && str_starts_with(realpath($path) ?: '', realpath(ROOT_PATH . '/backups') ?: '')) {
                @unlink($path);
            }
            Database::execute('DELETE FROM backup_runs WHERE backup_id = ? AND tenant_id = ?', [(int)$row['backup_id'], Database::tenantId()]);
        }
    }

    private static function find(int $backupId): array
    {
        $row = Database::fetch('SELECT * FROM backup_runs WHERE backup_id = ? AND tenant_id = ? LIMIT 1', [$backupId, Database::tenantId()]);
        if (!$row) {
            Response::error('Backup run not found', 404);
        }
        return self::format($row);
    }

    private static function format(array $row): array
    {
        return [
            'backup_id' => (int)$row['backup_id'],
            'id' => (string)$row['backup_id'],
            'backup_type' => $row['backup_type'],
            'file_path' => $row['file_path'],
            'size_bytes' => $row['size_bytes'] !== null ? (int)$row['size_bytes'] : null,
            'status' => $row['status'],
            'started_at' => $row['started_at'],
            'finished_at' => $row['finished_at'],
            'error_text' => $row['error_text'],
            'created_by' => $row['created_by'] ? (int)$row['created_by'] : null,
        ];
    }

    private static function quoteIdent(string $identifier): string
    {
        return '`' . str_replace('`', '``', $identifier) . '`';
    }

    private static function settingInt(string $key, int $default): int
    {
        $row = Database::fetch('SELECT setting_value FROM settings WHERE setting_key = ? AND tenant_id = ? LIMIT 1', [$key, Database::tenantId()]);
        $value = (int)($row['setting_value'] ?? $default);
        return max(1, $value);
    }

    private static function audit(?int $actorId, string $action, string $table, int $recordId, mixed $before, mixed $after): void
    {
        // insertTenant() auto-stamps tenant_id from the current context.
        Database::insertTenant('audit_log', [
            'user_id'    => $actorId,
            'action'     => $action,
            'table_name' => $table,
            'record_id'  => $recordId,
            'old_value'  => $before !== null ? json_encode($before) : null,
            'new_value'  => $after !== null ? json_encode($after) : null,
            'ip_address' => null,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }
}
