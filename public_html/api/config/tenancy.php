<?php
// ─── Multi-tenant configuration ──────────────────────────────────────────────
// Reads the control-plane DB + shared app DB credentials and the tenant-secret
// encryption key from the server-side .env (one level above public_html/api).
//
// Two databases are involved:
//   • CONTROL-PLANE  (CP_*)  — the SaaS management DB (tenants, plans, billing).
//   • SHARED APP     (DB_*)  — default home for tenant business data (config/database.php).
//
// A tenant on a DEDICATED database is resolved at runtime from the
// `tenant_connections` table; its password is decrypted with TENANT_ENC_KEY.

$_envPath = dirname(__DIR__, 2) . '/.env';
$_env     = [];
if (file_exists($_envPath)) {
    foreach (file($_envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $_line) {
        if (str_starts_with(trim($_line), '#') || !str_contains($_line, '=')) continue;
        [$_k, $_v] = array_map('trim', explode('=', $_line, 2));
        // Strip surrounding quotes (handles passwords with # and special chars)
        if (strlen($_v) >= 2 &&
            (($_v[0] === '"' && $_v[-1] === '"') || ($_v[0] === "'" && $_v[-1] === "'"))) {
            $_v = substr($_v, 1, -1);
        }
        $_env[$_k] = $_v;
    }
}

// Control-plane DB (falls back to the shared DB host/user if not separately set)
define('CP_DB_HOST', $_env['CP_DB_HOST'] ?? ($_env['DB_HOST'] ?? '127.0.0.1'));
define('CP_DB_PORT', (int)($_env['CP_DB_PORT'] ?? ($_env['DB_PORT'] ?? 3306)));
define('CP_DB_NAME', $_env['CP_DB_NAME'] ?? 'saas_control');
define('CP_DB_USER', $_env['CP_DB_USER'] ?? ($_env['DB_USER'] ?? ''));
define('CP_DB_PASS', $_env['CP_DB_PASS'] ?? ($_env['DB_PASS'] ?? ''));

// AES key used to encrypt per-tenant DB passwords stored in tenant_connections.
// MUST be a 32-byte (256-bit) key, base64 or hex. Generate once, keep secret.
define('TENANT_ENC_KEY', $_env['TENANT_ENC_KEY'] ?? '');

// How the request maps to a tenant: 'subdomain' ({slug}.app.com) or 'header' (X-Tenant).
define('TENANT_RESOLUTION', $_env['TENANT_RESOLUTION'] ?? 'subdomain');
// Apex/root host that carries the marketing site + signup (no tenant).
define('APP_ROOT_DOMAIN', $_env['APP_ROOT_DOMAIN'] ?? 'localhost');

// Master switch for multi-tenancy enforcement. Keep OFF until the control-plane
// DB is created (platform/schema/control_plane.sql), the tenant_id migration is
// applied (database/migrations/001_add_tenant_id.sql) and tenant #1 is seeded
// (platform/schema/seed_tenant_1.sql). When OFF the app behaves exactly like the
// original single-company EcoSudar. When ON, authenticated requests resolve a
// tenant from the verified JWT `tid` claim and suspended/expired tenants are blocked.
define('TENANCY_ENABLED', filter_var($_env['TENANCY_ENABLED'] ?? 'false', FILTER_VALIDATE_BOOLEAN));
// Founding tenant — your own company. Existing data is backfilled to this id and
// legacy tokens (issued before the `tid` claim existed) resolve to it.
define('FOUNDING_TENANT_ID', (int)($_env['FOUNDING_TENANT_ID'] ?? 1));

// ── Billing (Razorpay) ───────────────────────────────────────────────────────
// Leave blank to keep billing in "inactive" mode (signups stay on free trial,
// no charges). Fill these from your Razorpay dashboard to enable real payments.
define('RAZORPAY_KEY_ID',        $_env['RAZORPAY_KEY_ID'] ?? '');
define('RAZORPAY_KEY_SECRET',    $_env['RAZORPAY_KEY_SECRET'] ?? '');
define('RAZORPAY_WEBHOOK_SECRET',$_env['RAZORPAY_WEBHOOK_SECRET'] ?? '');
define('BILLING_ENABLED', RAZORPAY_KEY_ID !== '' && RAZORPAY_KEY_SECRET !== '');
// Grace period (days) before a past_due tenant is suspended by the dunning cron.
define('BILLING_GRACE_DAYS', (int)($_env['BILLING_GRACE_DAYS'] ?? 7));

// ── Email (SMTP) ─────────────────────────────────────────────────────────────
// Leave SMTP_HOST blank to disable sending (Mailer::send no-ops + logs). Fill in
// to enable transactional email (welcome, password reset, etc.).
define('SMTP_HOST',      $_env['SMTP_HOST'] ?? '');
define('SMTP_PORT',      (int)($_env['SMTP_PORT'] ?? 587));
define('SMTP_USER',      $_env['SMTP_USER'] ?? '');
define('SMTP_PASS',      $_env['SMTP_PASS'] ?? '');
define('SMTP_FROM',      $_env['SMTP_FROM'] ?? ($_env['SMTP_USER'] ?? ''));
define('SMTP_FROM_NAME', $_env['SMTP_FROM_NAME'] ?? 'Kynetropo');
define('MAIL_ENABLED',   SMTP_HOST !== '');
// Public base URL used in email links (e.g. https://app.kynetropo.com).
define('APP_PUBLIC_URL', rtrim($_env['APP_PUBLIC_URL'] ?? '', '/'));

unset($_envPath, $_env, $_line, $_k, $_v);
