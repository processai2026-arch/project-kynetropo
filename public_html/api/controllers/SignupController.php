<?php
declare(strict_types=1);

/**
 * SignupController — PUBLIC self-service onboarding.
 *
 *   GET  /plans   → list active subscription plans (for the pricing page).
 *   POST /signup  → provision a new TENANT (company) + a trialing subscription +
 *                   the owner's admin login, then the owner can sign in normally.
 *
 * Spans both databases: tenants/subscriptions live in the control plane
 * (PlatformDB); the owner user lives in the app DB (Database) scoped to the new
 * tenant. Cross-DB writes can't be one transaction, so on failure we best-effort
 * roll back the control-plane rows.
 */
class SignupController
{
    private const RESERVED = ['www', 'app', 'api', 'admin', 'mail', 'dealer', 'ecosudar', 'kynetropo', 'static', 'cdn'];

    /** GET /plans — public pricing data. */
    public function plans(Request $request): void
    {
        $rows = PlatformDB::fetchAll(
            'SELECT code, name, price_monthly, price_yearly, currency, trial_days, max_users, features
             FROM plans WHERE is_active = 1 ORDER BY sort_order ASC, plan_id ASC'
        );
        foreach ($rows as &$r) {
            $r['price_monthly'] = (float) $r['price_monthly'];
            $r['price_yearly']  = (float) $r['price_yearly'];
            $r['trial_days']    = (int) $r['trial_days'];
            $r['max_users']     = $r['max_users'] !== null ? (int) $r['max_users'] : null;
            $r['features']      = $r['features'] ? (json_decode($r['features'], true) ?: []) : [];
        }
        Response::success($rows);
    }

    /** POST /signup — create tenant + subscription + owner admin user. */
    public function signup(Request $request): void
    {
        $companyName = trim((string) $request->input('company_name', ''));
        $name        = trim((string) $request->input('name', ''));
        $email       = strtolower(trim((string) $request->input('email', '')));
        $phone       = preg_replace('/\D/', '', (string) $request->input('phone', ''));
        $password    = (string) $request->input('password', '');
        $planCode    = trim((string) $request->input('plan_code', 'trial')) ?: 'trial';

        // ── Validation ──────────────────────────────────────────────────────
        if (mb_strlen($companyName) < 2)              Response::error('Company name is required', 422);
        if (mb_strlen($name) < 2)                     Response::error('Your name is required', 422);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) Response::error('A valid email is required', 422);
        if (strlen($phone) < 7)                       Response::error('A valid phone number is required', 422);
        if (strlen($password) < 8)                    Response::error('Password must be at least 8 characters', 422);

        // ── Reject duplicates up front ──────────────────────────────────────
        // users.email/phone are globally unique; without this check a duplicate
        // would only fail deep inside provisioning (after the tenant row is made)
        // and surface as a confusing 500. Catch it here as a clean 409.
        $dupe = Database::fetch(
            'SELECT user_id FROM users WHERE email = ? OR phone = ? LIMIT 1',
            [$email, $phone]
        );
        if ($dupe) Response::error('An account with this email or phone already exists. Please sign in instead.', 409);

        // ── Require a verified email OTP before provisioning ─────────────────
        // The client must call /auth/send-otp then /auth/verify-otp for this email
        // (purpose = email_verification) first. Enforced server-side so the step
        // cannot be skipped by posting straight to /signup.
        $verified = Database::fetch(
            "SELECT otp_id FROM otp_verifications
              WHERE identifier = ? AND purpose = 'email_verification'
                AND verified_at IS NOT NULL AND verified_at >= (NOW() - INTERVAL 30 MINUTE)
              ORDER BY verified_at DESC LIMIT 1",
            [$email]
        );
        if (!$verified) Response::error('Please verify your email with the OTP code before creating your account.', 422);

        // ── Resolve plan (fall back to trial) ───────────────────────────────
        $plan = PlatformDB::fetch('SELECT * FROM plans WHERE code = ? AND is_active = 1 LIMIT 1', [$planCode])
              ?: PlatformDB::fetch("SELECT * FROM plans WHERE code = 'trial' LIMIT 1")
              ?: PlatformDB::fetch('SELECT * FROM plans WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 1');
        if (!$plan) Response::error('No subscription plans are configured', 500);
        $planId    = (int) $plan['plan_id'];
        $trialDays = (int) ($plan['trial_days'] ?? 14);

        // ── Unique subdomain slug ───────────────────────────────────────────
        $slug = $this->makeSlug($companyName);

        // ── Create control-plane records ────────────────────────────────────
        $tenantId = PlatformDB::insert(
            'INSERT INTO tenants (slug, company_name, status, plan_id, owner_email, owner_name, data_region, created_at)
             VALUES (?, ?, "trialing", ?, ?, ?, "shared", NOW())',
            [$slug, $companyName, $planId, $email, $name]
        );
        PlatformDB::insert(
            'INSERT INTO subscriptions (tenant_id, plan_id, billing_cycle, status, trial_ends_at, current_start, created_at)
             VALUES (?, ?, "monthly", "trialing", DATE_ADD(NOW(), INTERVAL ? DAY), NOW(), NOW())',
            [$tenantId, $planId, $trialDays]
        );

        // ── Create the owner (admin) user in the app DB, scoped to the tenant ─
        try {
            TenantContext::boot($tenantId); // so User::create stamps tenant_id = new tenant
            $userId = User::create([
                'user_type'       => 'admin',     // owner gets full ERP (admin) access
                'name'            => $name,
                'email'           => $email,
                'phone'           => $phone,
                'company_name'    => $companyName,
                'password'        => $password,
                'is_active'       => 1,
                'approval_status' => 'approved',
            ]);
            // Seed the tenant's company profile so their documents show their own
            // name from day one (tenant context is booted above).
            try {
                Database::insertTenant('settings', ['setting_key' => 'company_name', 'setting_value' => $companyName]);
            } catch (\Throwable $ignore) { /* non-fatal */ }
        } catch (\Throwable $e) {
            // best-effort rollback of the control-plane rows (cross-DB, not atomic)
            PlatformDB::execute('DELETE FROM subscriptions WHERE tenant_id = ?', [$tenantId]);
            PlatformDB::execute('DELETE FROM tenants WHERE tenant_id = ?', [$tenantId]);
            if ($e instanceof AppException) Response::error($e->getMessage(), 409);
            if ($e instanceof PDOException && $e->getCode() === '23000') {
                Response::error('An account with this email or phone already exists. Please sign in instead.', 409);
            }
            error_log('[Signup] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            Response::error('Could not complete signup. Please try again.', 500);
        }

        // Welcome email (no-ops cleanly if SMTP isn't configured).
        $loginUrl = $this->loginUrl($slug);
        $link = (defined('APP_PUBLIC_URL') && APP_PUBLIC_URL !== '' && str_starts_with($loginUrl, '/'))
            ? APP_PUBLIC_URL . $loginUrl : $loginUrl;
        Mailer::send($email, 'Welcome to Kynetropo', Mailer::layout(
            "Welcome, {$name}!",
            "<p>Your <strong>{$companyName}</strong> workspace on Kynetropo is ready, with a {$trialDays}-day free trial.</p>"
            . "<p>Sign in: <a href=\"{$link}\">{$link}</a></p>"
            . "<p>Email: {$email}</p>"
        ));

        Response::success([
            'tenant'      => ['id' => $tenantId, 'slug' => $slug, 'company_name' => $companyName],
            'user'        => ['id' => $userId, 'email' => $email],
            'plan'        => ['code' => $plan['code'], 'name' => $plan['name']],
            'trial_days'  => $trialDays,
            'login_url'   => $this->loginUrl($slug),
        ], 'Account created — you can now sign in.', 201);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function makeSlug(string $companyName): string
    {
        $base = strtolower($companyName);
        $base = preg_replace('/[^a-z0-9]+/', '-', $base);
        $base = trim((string) $base, '-');
        if ($base === '') $base = 'tenant';
        $base = substr($base, 0, 50);

        $slug = $base;
        $n = 1;
        while (in_array($slug, self::RESERVED, true)
               || PlatformDB::fetch('SELECT tenant_id FROM tenants WHERE slug = ? LIMIT 1', [$slug])) {
            $n++;
            $slug = $base . '-' . $n;
        }
        return $slug;
    }

    private function loginUrl(string $slug): string
    {
        $root = defined('APP_ROOT_DOMAIN') ? APP_ROOT_DOMAIN : 'localhost';
        // On a real domain, each tenant logs in at its own subdomain.
        if ($root && $root !== 'localhost') {
            return 'https://' . $slug . '.' . $root . '/login';
        }
        return '/login';
    }
}
