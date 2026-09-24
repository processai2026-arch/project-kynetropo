<?php
declare(strict_types=1);

/**
 * TenantContext — resolves and holds the CURRENT tenant for a request.
 *
 * Resolution order (first match wins):
 *   1. JWT claim `tid` (set at login) — authoritative once authenticated.
 *   2. Subdomain of the request host: {slug}.yourapp.com  → tenants.slug
 *   3. Custom domain match            → tenants.custom_domain
 *   4. X-Tenant header (dev / API clients)
 *
 * Once resolved it exposes:
 *   • TenantContext::id()        — the tenant_id every app query must scope by
 *   • TenantContext::plan()      — plan row + feature flags (gating)
 *   • TenantContext::connection()— the DB connection params for this tenant
 *                                  (shared app DB by default; dedicated if split)
 *
 * The apex/root domain (marketing + signup) has NO tenant — id() returns null.
 */
class TenantContext
{
    private static ?array $tenant = null;
    private static bool $resolved = false;

    /** Resolve from the incoming request. Call once during bootstrap. */
    public static function boot(?int $jwtTenantId = null): void
    {
        // An explicit tenant id (verified JWT claim, or the login flow) ALWAYS
        // wins — even if a host-based boot already ran earlier this request
        // (e.g. the Router resolves public routes by host first). "Claim wins."
        if ($jwtTenantId !== null) {
            self::$tenant   = self::loadById($jwtTenantId);
            self::$resolved = true;
            return;
        }

        if (self::$resolved) return;
        self::$resolved = true;

        $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
        $host = preg_replace('/:\d+$/', '', $host); // strip port

        // Custom domain?
        if ($host && $host !== APP_ROOT_DOMAIN) {
            $byDomain = PlatformDB::fetch('SELECT * FROM tenants WHERE custom_domain = ? LIMIT 1', [$host]);
            if ($byDomain) { self::$tenant = $byDomain; return; }
        }

        // Subdomain: {slug}.root-domain
        if (TENANT_RESOLUTION === 'subdomain' && $host && str_ends_with($host, '.' . APP_ROOT_DOMAIN)) {
            $slug = substr($host, 0, -1 * (strlen(APP_ROOT_DOMAIN) + 1));
            // Reserved portal subdomains are NOT tenant slugs. The customer/dealer
            // storefronts are single hosts serving ALL tenants; they identify the
            // tenant via the X-Tenant header (below) or the JWT, not the subdomain.
            $reserved = ['www', 'app', 'api', 'customer', 'dealer', 'mail', 'static', 'cdn'];
            if ($slug && !in_array($slug, $reserved, true)) {
                self::$tenant = PlatformDB::fetch('SELECT * FROM tenants WHERE slug = ? LIMIT 1', [$slug]);
                return;
            }
        }

        // Explicit header (dev / programmatic clients)
        $header = $_SERVER['HTTP_X_TENANT'] ?? '';
        if ($header !== '') {
            self::$tenant = ctype_digit($header)
                ? self::loadById((int)$header)
                : PlatformDB::fetch('SELECT * FROM tenants WHERE slug = ? LIMIT 1', [$header]);
        }
    }

    private static function loadById(int $id): ?array
    {
        return PlatformDB::fetch('SELECT * FROM tenants WHERE tenant_id = ? LIMIT 1', [$id]);
    }

    public static function has(): bool { return self::$tenant !== null; }

    public static function id(): ?int
    {
        return self::$tenant ? (int) self::$tenant['tenant_id'] : null;
    }

    /** The tenant_id that app queries MUST filter by. Hard-fails if missing. */
    public static function requireId(): int
    {
        $id = self::id();
        if ($id === null) {
            Response::error('No tenant context for this request', 400);
        }
        return $id;
    }

    public static function row(): ?array { return self::$tenant; }

    /** Enforce that the tenant is allowed to use the app right now. */
    public static function assertActive(): void
    {
        $t = self::$tenant;
        if (!$t) Response::error('Unknown tenant', 404);
        if (in_array($t['status'], ['suspended', 'cancelled'], true)) {
            Response::error('This account is ' . $t['status'] . '. Please contact billing.', 402);
        }
        // Trial expiry check
        if ($t['status'] === 'trialing') {
            $sub = PlatformDB::fetch(
                'SELECT trial_ends_at FROM subscriptions WHERE tenant_id = ? ORDER BY subscription_id DESC LIMIT 1',
                [(int)$t['tenant_id']]
            );
            if ($sub && $sub['trial_ends_at'] && strtotime($sub['trial_ends_at']) < time()) {
                Response::error('Your free trial has ended. Upgrade to continue.', 402);
            }
        }
    }

    /** Plan + decoded feature flags for the current tenant. */
    public static function plan(): array
    {
        $t = self::$tenant;
        if (!$t || empty($t['plan_id'])) return ['features' => []];
        $plan = PlatformDB::fetch('SELECT * FROM plans WHERE plan_id = ? LIMIT 1', [(int)$t['plan_id']]);
        if (!$plan) return ['features' => []];
        $plan['features'] = $plan['features'] ? (json_decode($plan['features'], true) ?: []) : [];
        return $plan;
    }

    /** Is a module enabled for this tenant's plan? */
    public static function featureEnabled(string $feature): bool
    {
        return !empty(self::plan()['features'][$feature]);
    }

    public static function assertFeature(string $feature): void
    {
        if (!self::featureEnabled($feature)) {
            Response::error("Your plan doesn't include this feature ($feature). Upgrade to use it.", 402);
        }
    }

    /**
     * DB connection params for THIS tenant's business data.
     * Returns ['shared' => true] for the default shared DB, or decrypted
     * dedicated-DB credentials for a split-out tenant.
     */
    public static function connection(): array
    {
        $t = self::$tenant;
        $region = $t['data_region'] ?? 'shared';
        if ($region === 'shared' || $region === '') {
            return ['shared' => true];
        }
        $conn = PlatformDB::fetch('SELECT * FROM tenant_connections WHERE region_key = ? LIMIT 1', [$region]);
        if (!$conn) {
            error_log("[TenantContext] data_region '$region' has no tenant_connections row; falling back to shared");
            return ['shared' => true];
        }
        return [
            'shared' => false,
            'host'   => $conn['db_host'],
            'port'   => (int) $conn['db_port'],
            'name'   => $conn['db_name'],
            'user'   => $conn['db_user'],
            'pass'   => self::decrypt($conn['db_pass_enc']),
        ];
    }

    // ── AES-256-GCM for dedicated-tenant DB passwords ───────────────────────
    public static function encrypt(string $plain): string
    {
        $key = self::key();
        $iv  = random_bytes(12);
        $tag = '';
        $ct  = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        return base64_encode($iv . $tag . $ct);
    }

    private static function decrypt(string $enc): string
    {
        $raw = base64_decode($enc, true) ?: '';
        $iv  = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $ct  = substr($raw, 28);
        $out = openssl_decrypt($ct, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        return $out === false ? '' : $out;
    }

    private static function key(): string
    {
        $k = TENANT_ENC_KEY;
        // Accept base64 or hex; normalise to 32 raw bytes.
        $decoded = base64_decode($k, true);
        if ($decoded !== false && strlen($decoded) === 32) return $decoded;
        if (ctype_xdigit($k) && strlen($k) === 64) return hex2bin($k);
        return hash('sha256', $k, true); // last-resort derive
    }
}
