<?php
declare(strict_types=1);

class User
{
    // Safe public fields — never include password_hash in API responses
    private const BASE_PUBLIC_FIELDS = 'user_id, name, email, phone, user_type, company_name,
        address, city, state, pincode, gst_number, udyam_number, is_active, approval_status, created_at, updated_at';

    /**
     * @throws AppException
     */
    public static function create(array $data): int
    {
        if (self::existsByPhone($data['phone'])) {
            throw new AppException('Phone number already registered', 409);
        }
        if (self::existsByEmail($data['email'])) {
            throw new AppException('Email address already registered', 409);
        }

        $row = [
            'name'            => Request::sanitize($data['name']),
            'email'           => strtolower(trim($data['email'])),
            'phone'           => preg_replace('/\D/', '', $data['phone']), // digits only
            'user_type'       => strtolower($data['user_type']),           // customer | dealer
            'company_name'    => isset($data['company_name']) ? Request::sanitize($data['company_name']) : null,
            'address'         => isset($data['address'])      ? Request::sanitize($data['address'])      : null,
            'city'            => isset($data['city'])         ? Request::sanitize($data['city'])         : null,
            'state'           => isset($data['state'])        ? Request::sanitize($data['state'])        : null,
            'pincode'         => isset($data['pincode'])      ? Request::sanitize($data['pincode'])      : null,
            'gst_number'      => isset($data['gst_number'])   ? strtoupper(trim($data['gst_number']))   : null,
            'udyam_number'    => isset($data['udyam_number']) ? strtoupper(trim($data['udyam_number'])) : null,
            'password_hash'   => password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => BCRYPT_COST]),
            'is_active'       => $data['is_active'] ?? true,
            'approval_status' => $data['approval_status'] ?? 'approved',
            'created_at'      => date('Y-m-d H:i:s'),
        ];
        // Stamp the tenant when one is resolved (tenant subdomain signup); on the
        // apex/root domain there is no tenant and the column DEFAULTs to the founder.
        if (defined('TENANCY_ENABLED') && TENANCY_ENABLED && class_exists('TenantContext') && TenantContext::has()) {
            $row = ['tenant_id' => (int)TenantContext::id()] + $row;
        }
        $cols = array_keys($row);
        $ph   = implode(', ', array_fill(0, count($cols), '?'));
        $newId = Database::insert(
            'INSERT INTO users (`' . implode('`, `', $cols) . '`) VALUES (' . $ph . ')',
            array_values($row)
        );

        /*
         * Some installations carry a `users` table whose AUTO_INCREMENT primary
         * key is `id`, with `user_id` as a separate nullable column left over
         * from an older schema — while every other query in the application
         * (AuthMiddleware, Role, the whole admin surface) identifies a user by
         * `user_id`. On those installations a freshly created account has
         * user_id = NULL and can never log in: authentication looks it up by
         * user_id and finds nothing.
         *
         * Stamp user_id to match the primary key so a new account is usable.
         * Guarded by a column check, so installations where user_id IS the
         * primary key are left completely untouched.
         */
        if (self::hasSeparateUserIdColumn()) {
            Database::execute('UPDATE users SET user_id = id WHERE id = ? AND user_id IS NULL', [$newId]);
        }

        return $newId;
    }

    /**
     * True when `user_id` exists alongside a separate `id` primary key — i.e.
     * the legacy dual-column layout described in create().
     */
    public static function hasSeparateUserIdColumn(): bool
    {
        static $cached = null;
        if ($cached !== null) {
            return $cached;
        }
        try {
            $hasId     = Database::fetch("SHOW COLUMNS FROM users LIKE 'id'") !== null;
            $hasUserId = Database::fetch("SHOW COLUMNS FROM users LIKE 'user_id'") !== null;
            $cached    = $hasId && $hasUserId;
        } catch (Throwable $e) {
            $cached = false;
        }
        return $cached;
    }

    /**
     * Tenant predicate for the users table. Users belong to a tenant, but the
     * LOGIN/registration lookups run before any JWT exists, so we scope only when
     * a tenant is resolved (a tenant subdomain). On the apex/root domain (no
     * tenant) these stay global. Returns [sqlFragment, params].
     */
    private static function tenantPredicate(): array
    {
        if (defined('TENANCY_ENABLED') && TENANCY_ENABLED
            && class_exists('TenantContext') && TenantContext::has()) {
            return [' AND tenant_id = ?', [(int)TenantContext::id()]];
        }
        return ['', []];
    }

    public static function findById(int $id): ?array
    {
        [$ts, $tp] = self::tenantPredicate();
        return Database::fetch(
            'SELECT ' . self::publicFields() . ' FROM users WHERE user_id = ?' . $ts . ' LIMIT 1',
            [$id, ...$tp]
        );
    }

    public static function findByPhone(string $phone): ?array
    {
        $digits = preg_replace('/\D/', '', $phone);
        [$ts, $tp] = self::tenantPredicate();
        return Database::fetch(
            'SELECT * FROM users WHERE phone = ?' . $ts . ' LIMIT 1',
            [$digits, ...$tp]
        );
    }

    public static function findByEmail(string $email): ?array
    {
        [$ts, $tp] = self::tenantPredicate();
        return Database::fetch(
            'SELECT * FROM users WHERE email = ?' . $ts . ' LIMIT 1',
            [strtolower(trim($email)), ...$tp]
        );
    }

    public static function existsByPhone(string $phone): bool
    {
        $digits = preg_replace('/\D/', '', $phone);
        [$ts, $tp] = self::tenantPredicate();
        return Database::fetch('SELECT user_id FROM users WHERE phone = ?' . $ts . ' LIMIT 1', [$digits, ...$tp]) !== null;
    }

    public static function existsByEmail(string $email): bool
    {
        [$ts, $tp] = self::tenantPredicate();
        return Database::fetch('SELECT user_id FROM users WHERE email = ?' . $ts . ' LIMIT 1', [strtolower(trim($email)), ...$tp]) !== null;
    }

    public static function existsByPhoneExcluding(string $phone, int $excludeUserId): bool
    {
        $digits = preg_replace('/\D/', '', $phone);
        [$ts, $tp] = self::tenantPredicate();
        return Database::fetch('SELECT user_id FROM users WHERE phone = ? AND user_id != ?' . $ts . ' LIMIT 1', [$digits, $excludeUserId, ...$tp]) !== null;
    }

    public static function existsByEmailExcluding(string $email, int $excludeUserId): bool
    {
        [$ts, $tp] = self::tenantPredicate();
        return Database::fetch('SELECT user_id FROM users WHERE email = ? AND user_id != ?' . $ts . ' LIMIT 1', [strtolower(trim($email)), $excludeUserId, ...$tp]) !== null;
    }

    public static function verifyPassword(string $plain, string $hash): bool
    {
        return password_verify($plain, $hash);
    }

    /**
     * @throws AppException
     */
    public static function update(int $userId, array $data): void
    {
        $allowed = ['name', 'email', 'phone', 'company_name', 'address', 'city', 'state', 'pincode', 'gst_number', 'udyam_number'];
        if (self::hasStaffRoleColumn()) {
            $allowed[] = 'staff_role';
        }
        $fields  = [];
        $values  = [];

        foreach ($allowed as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $fields[] = "$field = ?";
            $values[] = match ($field) {
                'email'        => strtolower(trim((string)$data[$field])),
                'phone'        => preg_replace('/\D/', '', (string)$data[$field]),
                'staff_role'   => $data[$field] === null ? null : AdminMiddleware::normalizeStaffRole($data[$field]),
                'gst_number'   => strtoupper(trim((string)$data[$field])),
                'udyam_number' => strtoupper(trim((string)$data[$field])),
                default        => Request::sanitize((string)$data[$field]),
            };
        }

        if (empty($fields)) {
            throw new AppException('No valid fields provided to update', 400);
        }

        [$ts, $tp] = self::tenantPredicate();
        $values[] = $userId;
        Database::execute(
            'UPDATE users SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE user_id = ?' . $ts,
            [...$values, ...$tp]
        );
    }

    public static function updatePassword(int $userId, string $newPassword): void
    {
        [$ts, $tp] = self::tenantPredicate();
        Database::execute(
            'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?' . $ts,
            [password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => BCRYPT_COST]), $userId, ...$tp]
        );
    }

    /**
     * Soft-deactivate — marks is_active = FALSE. Data preserved.
     */
    public static function deactivate(int $userId): void
    {
        [$ts, $tp] = self::tenantPredicate();
        Database::execute(
            'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE user_id = ?' . $ts,
            [$userId, ...$tp]
        );
    }

    /**
     * Strips password_hash from a full DB row before returning to client.
     */
    public static function sanitizeForResponse(array $user): array
    {
        unset($user['password_hash']);
        $user['is_active'] = (bool)$user['is_active'];
        return $user;
    }

    public static function publicFields(): string
    {
        return self::BASE_PUBLIC_FIELDS . (self::hasStaffRoleColumn() ? ', staff_role' : '');
    }

    public static function hasStaffRoleColumn(): bool
    {
        static $hasColumn = null;
        if ($hasColumn !== null) {
            return $hasColumn;
        }

        try {
            $hasColumn = Database::fetch("SHOW COLUMNS FROM users LIKE 'staff_role'") !== null;
        } catch (Throwable $e) {
            $hasColumn = false;
        }

        return $hasColumn;
    }
}
