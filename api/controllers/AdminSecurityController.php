<?php
declare(strict_types=1);

/**
 * Account security: optional TOTP MFA (enroll/verify/disable) + audit-log viewer.
 * MFA is additive — it does NOT gate the existing login flow; it lets a user
 * enrol a TOTP authenticator and exposes status for future enforcement.
 * All tenant + user scoped.
 */
class AdminSecurityController
{
    private function userId(Request $request): int
    {
        $id = isset($request->user['user_id']) ? (int)$request->user['user_id'] : 0;
        if ($id <= 0) Response::error('Unauthenticated', 401);
        return $id;
    }

    public function mfaStatus(Request $request): void
    {
        $row = Database::fetch(
            'SELECT enabled, enabled_at FROM mfa_secrets WHERE tenant_id = ? AND user_id = ? LIMIT 1',
            [Database::tenantId(), $this->userId($request)]
        );
        Response::success([
            'enrolled' => $row !== null,
            'enabled'  => $row ? (bool)$row['enabled'] : false,
        ]);
    }

    public function mfaEnroll(Request $request): void
    {
        $uid = $this->userId($request);
        $secret = self::randomBase32(32);
        Database::execute(
            'INSERT INTO mfa_secrets (tenant_id, user_id, secret, enabled) VALUES (?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE secret = VALUES(secret), enabled = 0, enabled_at = NULL',
            [Database::tenantId(), $uid, $secret]
        );
        $issuer = defined('APP_NAME') ? APP_NAME : 'Kynetropo';
        $label  = rawurlencode($issuer) . ':' . rawurlencode((string)($request->user['email'] ?? ('user' . $uid)));
        $uri = "otpauth://totp/{$label}?secret={$secret}&issuer=" . rawurlencode($issuer) . '&period=30&digits=6';
        Response::success(['secret' => $secret, 'otpauth_uri' => $uri], 'Scan the QR / enter the code to verify');
    }

    public function mfaVerify(Request $request): void
    {
        $uid = $this->userId($request);
        $code = preg_replace('/\D/', '', (string)$request->input('code', ''));
        $row = Database::fetch('SELECT secret FROM mfa_secrets WHERE tenant_id = ? AND user_id = ? LIMIT 1', [Database::tenantId(), $uid]);
        if (!$row) Response::error('Start enrollment first', 400);
        if (!self::verifyTotp((string)$row['secret'], $code)) Response::error('Invalid code', 422);
        Database::execute('UPDATE mfa_secrets SET enabled = 1, enabled_at = NOW() WHERE tenant_id = ? AND user_id = ?', [Database::tenantId(), $uid]);
        Response::success(['enabled' => true], 'MFA enabled');
    }

    public function mfaDisable(Request $request): void
    {
        $uid = $this->userId($request);
        Database::execute('DELETE FROM mfa_secrets WHERE tenant_id = ? AND user_id = ?', [Database::tenantId(), $uid]);
        Response::success(['enabled' => false], 'MFA disabled');
    }

    public function auditLog(Request $request): void
    {
        $page = max(1, (int)$request->query('page', 1));
        $limit = min(100, max(1, (int)$request->query('limit', 50)));
        // Alias audit_log as `a` everywhere: the rows query joins `users` (which
        // also has tenant_id), so an unqualified tenant_id is ambiguous (1052).
        $where = ['a.tenant_id = ?'];
        $params = [Database::tenantId()];
        if ($action = $request->query('action')) { $where[] = 'a.action = ?'; $params[] = $action; }
        if ($table = $request->query('table')) { $where[] = 'a.table_name = ?'; $params[] = $table; }
        $w = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM audit_log a WHERE $w", $params);
        $rows = Database::fetchAll(
            "SELECT a.log_id AS audit_id, a.user_id, u.name AS user_name, a.action, a.table_name, a.record_id,
                    a.old_value, a.new_value, a.ip_address, a.created_at
             FROM audit_log a LEFT JOIN users u ON u.user_id = a.user_id AND u.tenant_id = a.tenant_id
             WHERE $w ORDER BY a.log_id DESC LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );
        Response::paginated($rows, ['page' => $page, 'limit' => $limit, 'total' => $total, 'total_pages' => (int)ceil($total / $limit)]);
    }

    // ── TOTP (RFC 6238) — no external deps ────────────────────────────────────

    private static function randomBase32(int $len): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $s = '';
        for ($i = 0; $i < $len; $i++) $s .= $alphabet[random_int(0, 31)];
        return $s;
    }

    private static function verifyTotp(string $secret, string $code, int $window = 1): bool
    {
        if (strlen($code) !== 6) return false;
        $key = self::base32Decode($secret);
        $slice = (int)floor(time() / 30);
        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals(self::totpAt($key, $slice + $i), $code)) return true;
        }
        return false;
    }

    private static function totpAt(string $key, int $slice): string
    {
        $bin = pack('N*', 0) . pack('N*', $slice);
        $hash = hash_hmac('sha1', $bin, $key, true);
        $offset = ord($hash[19]) & 0x0f;
        $part = (ord($hash[$offset]) & 0x7f) << 24
              | (ord($hash[$offset + 1]) & 0xff) << 16
              | (ord($hash[$offset + 2]) & 0xff) << 8
              | (ord($hash[$offset + 3]) & 0xff);
        return str_pad((string)($part % 1000000), 6, '0', STR_PAD_LEFT);
    }

    private static function base32Decode(string $b32): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $b32 = strtoupper($b32);
        $bits = '';
        for ($i = 0; $i < strlen($b32); $i++) {
            $v = strpos($alphabet, $b32[$i]);
            if ($v === false) continue;
            $bits .= str_pad(decbin($v), 5, '0', STR_PAD_LEFT);
        }
        $bytes = '';
        for ($i = 0; $i + 8 <= strlen($bits); $i += 8) {
            $bytes .= chr((int)bindec(substr($bits, $i, 8)));
        }
        return $bytes;
    }
}
