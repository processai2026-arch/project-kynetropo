<?php
declare(strict_types=1);

/**
 * Client and project IDs shown in the CRM: CL-0001, PRJ-0001, …
 *
 * A new record gets the next number after the highest one already used, so the
 * numbers run oldest to newest (database/125_add_client_project_codes.sql
 * numbered the existing rows the same way). The code stays editable: whatever
 * someone types is kept, as long as no other record of the same kind uses it.
 */
class OpsCodes
{
    public const CLIENT  = ['table' => 'ops_clients',  'column' => 'client_code',  'prefix' => 'CL-',  'label' => 'Client ID'];
    public const PROJECT = ['table' => 'ops_projects', 'column' => 'project_code', 'prefix' => 'PRJ-', 'label' => 'Project ID'];

    private const MAX_LENGTH = 30;

    /** The next unused code, e.g. CL-0018 when CL-0017 is the highest. */
    public static function next(int $tenantId, array $kind): string
    {
        ['table' => $table, 'column' => $column, 'prefix' => $prefix] = $kind;
        $row = Database::fetch(
            "SELECT COALESCE(MAX(CAST(SUBSTRING($column, ?) AS UNSIGNED)), 0) AS n
               FROM $table
              WHERE tenant_id = ? AND $column REGEXP ?",
            [strlen($prefix) + 1, $tenantId, '^' . preg_quote($prefix, '/') . '[0-9]+$']
        );
        return $prefix . str_pad((string)(((int)($row['n'] ?? 0)) + 1), 4, '0', STR_PAD_LEFT);
    }

    /**
     * A code someone typed, checked: trimmed, upper-cased, not empty, not too long
     * and not used by another record ($exceptId is the record being edited).
     */
    public static function accept(int $tenantId, array $kind, mixed $raw, ?int $exceptId = null): string
    {
        ['table' => $table, 'column' => $column, 'label' => $label] = $kind;
        $code = strtoupper(trim((string)$raw));
        if ($code === '') {
            throw new AppException("$label cannot be empty", 422);
        }
        if (strlen($code) > self::MAX_LENGTH) {
            throw new AppException("$label can be at most " . self::MAX_LENGTH . ' characters', 422);
        }
        $clash = Database::fetch(
            "SELECT id, name FROM $table WHERE tenant_id = ? AND $column = ? AND id <> ? LIMIT 1",
            [$tenantId, $code, $exceptId ?? 0]
        );
        if ($clash) {
            throw new AppException("$label $code is already used by {$clash['name']}", 422);
        }
        return $code;
    }
}
