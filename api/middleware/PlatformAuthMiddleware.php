<?php
declare(strict_types=1);

/**
 * Guards the super-admin (control-plane) routes. Distinct from tenant auth:
 * the JWT must carry scope='platform' and map to an active platform_admins row.
 * Does NOT boot a TenantContext — platform admins operate across all tenants.
 */
class PlatformAuthMiddleware
{
    public static function handle(Request $request): void
    {
        $token = $request->bearerToken();
        if ($token === null) {
            Response::error('Authorization token required', 401);
        }
        $payload = JWT::decode($token);
        if ($payload === null || ($payload['scope'] ?? '') !== 'platform' || ($payload['type'] ?? '') !== 'access') {
            Response::error('Invalid or expired platform token', 401);
        }
        $admin = PlatformDB::fetch(
            'SELECT admin_id, email, name, role, is_active FROM platform_admins WHERE admin_id = ? LIMIT 1',
            [(int)$payload['sub']]
        );
        if (!$admin || !(int)$admin['is_active']) {
            Response::error('Platform admin not found or inactive', 401);
        }
        $request->platformAdmin = $admin;
    }
}
