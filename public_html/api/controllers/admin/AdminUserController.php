<?php
declare(strict_types=1);

/**
 * Admin User Controller
 * GET    /admin/users              — List all users (paginated, searchable)
 * GET    /admin/users/{id}/stats  — Per-status order breakdown for one user
 * POST   /admin/users              — Create a dealer/customer as admin
 * PUT    /admin/users/{id}         — Update any user's profile
 * PUT    /admin/users/{id}/status  — Activate / deactivate a user
 * DELETE /admin/users/{id}         — Soft-deactivate a user (preserves order history)
 *
 * Customer-master + retention-intelligence additions (database/create_customers_extra.sql):
 * GET    /admin/users/{id}/detail        — Full customer master incl. address/last order/health
 * POST   /admin/users/{id}/reset-password — Admin-initiated reset; generates + emails a new credential
 * GET    /admin/customers/health          — Tenant-scoped retention dashboard (segments, at-risk, high-value)
 * POST   /admin/users/{id}/recompute-health — Recompute one customer's health score on demand
 */
class AdminUserController
{
    /** Current tenant's company name from settings, with a neutral fallback. */
    private static function companyName(): string
    {
        try {
            $row = Database::fetch(
                "SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = 'company_name' LIMIT 1",
                [Database::tenantId()]
            );
            if (!empty($row['setting_value'])) {
                return $row['setting_value'];
            }
        } catch (\Throwable $e) {
            // fall through to default
        }
        return 'Your Company';
    }

    /** Current tenant's company support email from settings, with a neutral fallback. */
    private static function companyEmail(): string
    {
        try {
            $row = Database::fetch(
                "SELECT setting_value FROM settings WHERE tenant_id = ? AND setting_key = 'company_email' LIMIT 1",
                [Database::tenantId()]
            );
            if (!empty($row['setting_value'])) {
                return $row['setting_value'];
            }
        } catch (\Throwable $e) {
            // fall through to default
        }
        return 'noreply@kynetropo.com';
    }

    // ─── GET /admin/users ────────────────────────────────────────────────────

    public function index(Request $request): void
    {
        $page = max(1, (int) $request->query('page', 1));
        $limit = min(100, max(1, (int) $request->query('limit', 500)));

        $where = ['u.tenant_id = ?'];
        $params = [Database::tenantId()];

        // Filter by user_type
        $userType = $request->query('user_type');
        if ($userType && in_array($userType, ['customer', 'dealer', 'admin'], true)) {
            $where[] = 'u.user_type = ?';
            $params[] = $userType;
        }

        // Filter by is_active
        $isActive = $request->query('is_active');
        if ($isActive !== null && $isActive !== '') {
            $where[] = 'u.is_active = ?';
            $params[] = $isActive === 'false' ? 0 : 1;
        }

        $staffRole = $request->query('staff_role');
        if ($staffRole !== null && $staffRole !== '' && User::hasStaffRoleColumn()) {
            $staffRole = AdminMiddleware::normalizeStaffRole($staffRole);
            if ($staffRole === null) {
                Response::error('Invalid staff_role', 422);
            }
            $where[] = 'u.staff_role = ?';
            $params[] = $staffRole;
        }

        // Search name / email / phone
        $search = $request->query('search');
        if ($search && trim($search) !== '') {
            $like = '%' . trim($search) . '%';
            $where[] = '(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        // Sort
        $allowedSort = ['created_at' => 'u.created_at', 'name' => 'u.name', 'total_orders' => 'total_orders'];
        $sortField = $allowedSort[$request->query('sort', 'created_at')] ?? 'u.created_at';
        $sortDir = strtoupper($request->query('order', 'desc')) === 'ASC' ? 'ASC' : 'DESC';

        $whereClause = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM users u WHERE $whereClause", $params);
        $offset = ($page - 1) * $limit;
        $staffRoleSelect = User::hasStaffRoleColumn() ? 'u.staff_role,' : 'NULL AS staff_role,';

        $rows = Database::fetchAll(
            "SELECT u.user_id, u.name, u.email, u.phone, u.user_type,
                    $staffRoleSelect
                    u.company_name, u.address, u.city, u.state, u.pincode,
                    u.udyam_number, u.gst_number, u.is_active, u.created_at,
                    COUNT(DISTINCT o.order_id)       AS total_orders,
                    COALESCE(SUM(o.total_amount), 0) AS total_spent,
                    COALESCE(u.last_order_at, MAX(o.created_at)) AS last_order_at,
                    chs.health_score, chs.segment, chs.is_at_risk, chs.is_high_value
             FROM users u
             LEFT JOIN orders o ON o.user_id = u.user_id AND o.tenant_id = u.tenant_id
             LEFT JOIN customer_health_scores chs ON chs.customer_id = u.user_id AND chs.tenant_id = u.tenant_id
             WHERE $whereClause
             GROUP BY u.user_id
             ORDER BY $sortField $sortDir
             LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );

        foreach ($rows as &$r) {
            $r['is_active'] = (bool) $r['is_active'];
            $r['total_orders'] = (int) $r['total_orders'];
            $r['total_spent'] = (float) $r['total_spent'];
            $r['health_score'] = $r['health_score'] !== null ? (float) $r['health_score'] : null;
            $r['is_at_risk'] = $r['is_at_risk'] !== null ? (bool) $r['is_at_risk'] : false;
            $r['is_high_value'] = $r['is_high_value'] !== null ? (bool) $r['is_high_value'] : false;
        }

        Response::paginated($rows, [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'total_pages' => (int) ceil($total / $limit),
        ]);
    }

    // ─── POST /admin/users ───────────────────────────────────────────────────

    public function store(Request $request): void
    {
        Validator::make($request->only(['name', 'phone', 'password', 'user_type']), [
            'user_type' => 'required|in:customer,dealer',
            'name' => 'required|string|min:2|max:100',
            'phone' => 'required|phone',
            'password' => 'required|min:6|max:72',
        ])->validate();

        $phone = preg_replace('/\D/', '', (string) $request->input('phone'));
        $rawEmail = trim((string) ($request->input('email') ?? ''));
        $hasEmail = $rawEmail !== '';
        $email = $hasEmail ? $rawEmail : $phone . '@noemail.kynetropo.local';

        $name = (string) $request->input('name');
        $rawPassword = (string) $request->input('password');
        $userType = (string) $request->input('user_type');
        $companyName = (string) ($request->input('company_name') ?? '');
        $slug = TenantContext::row()['slug'] ?? '';
        $portalUrl = 'https://customer.app.kynetropo.com/?store=' . rawurlencode($slug);

        try {
            $userId = User::create([
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'user_type' => $userType,
                'company_name' => $request->input('company_name'),
                'address' => $request->input('address'),
                'city' => $request->input('city'),
                'state' => $request->input('state'),
                'pincode' => $request->input('pincode'),
                'gst_number' => $request->input('gst_number'),
                'udyam_number' => $request->input('udyam_number'),
                'password' => $rawPassword,
            ]);
        } catch (AppException $e) {
            Response::error($e->getMessage(), $e->getCode());
        }

        $user = User::findById($userId);

        // ── Send credential emails ──────────────────────────────────────────
        $tenantCompanyName = self::companyName();
        $adminEmail = $request->user['email'] ?? self::companyEmail();
        $displayType = ucfirst($userType);
        $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: " . $tenantCompanyName . " <" . self::companyEmail() . ">\r\n";

        // Email to the new user (only when a real email was provided). Route through the
        // config-driven SMTP Mailer (no-ops + logs if SMTP unset) — same transport the rest
        // of the app uses — and report email_sent based on ACTUAL delivery, not just presence.
        $emailSent = false;
        if ($hasEmail) {
            $dealerSubject = "Welcome to {$tenantCompanyName} – Your Login Credentials";
            $dealerBody = $userType === 'customer'
                ? self::credentialEmailBody($name, $phone, $rawPassword, $companyName, $displayType, false, $tenantCompanyName, $tenantCompanyName, $portalUrl, $rawEmail)
                : self::credentialEmailBody($name, $phone, $rawPassword, $companyName, $displayType, false, $tenantCompanyName);
            $emailSent = Mailer::send($rawEmail, $dealerSubject, $dealerBody);
        }

        // Notification copy to admin
        $adminSubject = "New {$displayType} Added – {$name}";
        $adminBody = self::credentialEmailBody($name, $phone, $rawPassword, $companyName, $displayType, true, $tenantCompanyName);
        Mailer::send($adminEmail, $adminSubject, $adminBody);

        Response::success(
            array_merge(User::sanitizeForResponse($user), ['email_sent' => $emailSent]),
            'User created successfully',
            201
        );
    }

    private static function credentialEmailBody(
        string $name,
        string $phone,
        string $password,
        string $companyName,
        string $userType,
        bool $isAdminCopy,
        ?string $tenantCompanyName = null,
        ?string $storeName = null,
        ?string $portalUrl = null,
        ?string $loginEmail = null
    ): string {
        $tenantCompanyName = $tenantCompanyName ?: self::companyName();
        $title = $isAdminCopy ? "New {$userType} Account Created" : "Welcome to {$tenantCompanyName}";
        $intro = $isAdminCopy
            ? "A new {$userType} account has been created. Here are the details:"
            : "Your {$userType} account on the {$tenantCompanyName} platform is ready. Use the credentials below to log in to the mobile app.";
        $company = $companyName ? "<tr><td style='padding:6px 0;color:#6b7280;'>Business Name</td><td style='padding:6px 0;font-weight:600;'>" . htmlspecialchars($companyName) . "</td></tr>" : '';
        $store = $storeName ? "<tr><td style='padding:6px 0;color:#6b7280;'>Store</td><td style='padding:6px 0;font-weight:600;'>" . htmlspecialchars($storeName) . "</td></tr>" : '';
        $portal = $portalUrl ? "<tr><td style='padding:6px 0;color:#6b7280;'>Customer Portal</td><td style='padding:6px 0;font-weight:600;'><a href='" . htmlspecialchars($portalUrl) . "'>" . htmlspecialchars($portalUrl) . "</a></td></tr>" : '';
        $emailLogin = $loginEmail ? "<tr><td style='padding:6px 0;color:#6b7280;'>Login (Email)</td><td style='padding:6px 0;font-weight:600;font-family:monospace;'>" . htmlspecialchars($loginEmail) . "</td></tr>" : '';

        return <<<HTML
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                <tr>
                  <td style="background:#2ea0da;padding:28px 36px;">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;">{$tenantCompanyName}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 36px;">
                    <h2 style="margin:0 0 8px;color:#111827;font-size:18px;">{$title}</h2>
                    <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.6;">{$intro}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px 20px;font-size:14px;">
                      <tr><td style="padding:6px 0;color:#6b7280;">Name</td><td style="padding:6px 0;font-weight:600;">{$name}</td></tr>
                      {$company}
                      {$store}
                      {$portal}
                      {$emailLogin}
                      <tr><td style="padding:6px 0;color:#6b7280;">Login (Phone)</td><td style="padding:6px 0;font-weight:600;font-family:monospace;">{$phone}</td></tr>
                      <tr><td style="padding:6px 0;color:#6b7280;">Password</td><td style="padding:6px 0;font-weight:600;font-family:monospace;">{$password}</td></tr>
                    </table>
                    <p style="margin:20px 0 0;color:#6b7280;font-size:12px;">Please change your password after first login. Do not share these credentials.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;color:#9ca3af;font-size:12px;">© {$tenantCompanyName} · This is an automated message, please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
HTML;
    }

    // ─── PUT /admin/users/{id} ───────────────────────────────────────────────

    public function update(Request $request): void
    {
        $userId = (int) $request->param('id');
        if ($userId <= 0) {
            Response::error('Invalid user ID', 400);
        }

        $staffRoleSelect = User::hasStaffRoleColumn() ? ', staff_role' : '';
        $existing = Database::fetch("SELECT user_id, user_type{$staffRoleSelect} FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1", [$userId, Database::tenantId()]);
        if (!$existing) {
            Response::error('User not found', 404);
        }

        $newPassword = trim((string) ($request->input('new_password') ?? ''));
        $input = $request->only(['name', 'email', 'phone', 'company_name', 'address', 'city', 'state', 'pincode', 'gst_number', 'udyam_number', 'staff_role']);

        if (empty($input) && $newPassword === '') {
            Response::error('Provide at least one field to update', 400);
        }

        if (array_key_exists('staff_role', $input)) {
            if (!User::hasStaffRoleColumn()) {
                Response::error('staff_role migration has not been applied', 500);
            }
            if (($existing['user_type'] ?? '') !== 'admin') {
                Response::error('staff_role only applies to admin users', 422);
            }

            $normalizedRole = AdminMiddleware::normalizeStaffRole($input['staff_role']);
            if ($normalizedRole === null) {
                Response::error('staff_role must be one of: ' . implode(', ', AdminMiddleware::validStaffRoles()), 422);
            }
            $input['staff_role'] = $normalizedRole;
        }

        if (!empty($input)) {
            Validator::make($input, [
                'name' => 'string|min:2|max:100',
                'email' => 'email|max:100',
                'phone' => 'phone',
                'company_name' => 'string|max:150',
                'address' => 'string|max:500',
                'city' => 'string|max:50',
                'state' => 'string|max:50',
                'pincode' => 'string|max:10',
                'gst_number' => 'gst',
                'udyam_number' => 'string|max:50',
                'staff_role' => 'string|in:owner,accountant,store_keeper,hr,sales',
            ])->validate();

            if (isset($input['email']) && User::existsByEmailExcluding($input['email'], $userId)) {
                Response::error('Email already in use by another user', 409);
            }
            if (isset($input['phone']) && User::existsByPhoneExcluding($input['phone'], $userId)) {
                Response::error('Phone number already in use by another user', 409);
            }

            try {
                $beforeStaffRole = $existing['staff_role'] ?? null;
                User::update($userId, $input);
                if (array_key_exists('staff_role', $input) && $beforeStaffRole !== $input['staff_role']) {
                    $this->auditStaffRoleChange(
                        (int)($request->user['user_id'] ?? 0),
                        $userId,
                        $beforeStaffRole,
                        $input['staff_role'],
                        $request->ip()
                    );
                }
            } catch (AppException $e) {
                Response::error($e->getMessage(), $e->getCode());
            }
        }

        // Handle password change
        if ($newPassword !== '') {
            if (strlen($newPassword) < 6) {
                Response::error('New password must be at least 6 characters', 422);
            }
            User::updatePassword($userId, $newPassword);

            // Notify admin of password change
            $updated = User::findById($userId);
            $tenantCompanyName = self::companyName();
            $adminEmail = $request->user['email'] ?? self::companyEmail();
            $dealerName = $updated['name'] ?? 'Dealer';
            $dealerPhone = $updated['phone'] ?? '';
            $dealerEmail = $updated['email'] ?? '';
            $hasRealEmail = !str_ends_with($dealerEmail, '@noemail.kynetropo.local');
            $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: " . $tenantCompanyName . " <" . self::companyEmail() . ">\r\n";

            // Notify the user if they have a real email (via the SMTP Mailer)
            if ($hasRealEmail) {
                $body = self::passwordChangedEmailBody($dealerName, $dealerPhone, $newPassword, false, $tenantCompanyName);
                Mailer::send($dealerEmail, "Your {$tenantCompanyName} Login Password Has Been Changed", $body);
            }

            // Always notify admin
            $adminBody = self::passwordChangedEmailBody($dealerName, $dealerPhone, $newPassword, true, $tenantCompanyName);
            Mailer::send($adminEmail, "Password Changed – {$dealerName}", $adminBody);
        }

        Response::success(User::sanitizeForResponse(User::findById($userId)), 'User updated successfully');
    }

    private function auditStaffRoleChange(int $actorId, int $targetUserId, ?string $before, string $after, string $ip): void
    {
        try {
            Database::insertTenant('audit_log', [
                'user_id'    => $actorId ?: null,
                'action'     => 'staff_role_changed',
                'table_name' => 'users',
                'record_id'  => $targetUserId,
                'old_value'  => json_encode(['staff_role' => $before]),
                'new_value'  => json_encode(['staff_role' => $after]),
                'ip_address' => $ip,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        } catch (Throwable $e) {
            error_log('Staff role audit failed: ' . $e->getMessage());
        }
    }

    private static function passwordChangedEmailBody(
        string $name,
        string $phone,
        string $newPassword,
        bool $isAdminCopy,
        ?string $tenantCompanyName = null
    ): string {
        $tenantCompanyName = $tenantCompanyName ?: self::companyName();
        $title = $isAdminCopy ? "Dealer Password Changed" : "Your Password Has Been Updated";
        $intro = $isAdminCopy
            ? "An admin has changed the login password for the following dealer:"
            : "Your login password on the {$tenantCompanyName} platform has been updated by an admin. Use the new credentials below.";

        return <<<HTML
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
            <tr><td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
                <tr>
                  <td style="background:#2ea0da;padding:28px 36px;">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;">{$tenantCompanyName}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 36px;">
                    <h2 style="margin:0 0 8px;color:#111827;font-size:18px;">{$title}</h2>
                    <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.6;">{$intro}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px 20px;font-size:14px;">
                      <tr><td style="padding:6px 0;color:#6b7280;">Name</td><td style="padding:6px 0;font-weight:600;">{$name}</td></tr>
                      <tr><td style="padding:6px 0;color:#6b7280;">Login (Phone)</td><td style="padding:6px 0;font-weight:600;font-family:monospace;">{$phone}</td></tr>
                      <tr><td style="padding:6px 0;color:#6b7280;">New Password</td><td style="padding:6px 0;font-weight:600;font-family:monospace;">{$newPassword}</td></tr>
                    </table>
                    <p style="margin:20px 0 0;color:#6b7280;font-size:12px;">Please change your password after logging in. Do not share these credentials.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;color:#9ca3af;font-size:12px;">© {$tenantCompanyName} · This is an automated message, please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
HTML;
    }

    // ─── PUT /admin/users/{id}/status ────────────────────────────────────────

    public function updateStatus(Request $request): void
    {
        $userId = (int) $request->param('id');
        if ($userId <= 0) {
            Response::error('Invalid user ID', 400);
        }

        Validator::make($request->only(['is_active']), [
            'is_active' => 'required',
        ])->validate();

        $isActive = filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($isActive === null) {
            Response::error('is_active must be true or false', 422);
        }

        $user = Database::fetch('SELECT user_id, user_type FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1', [$userId, Database::tenantId()]);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if ($user['user_type'] === 'admin') {
            Response::error('Cannot deactivate another admin account', 403);
        }

        Database::execute(
            'UPDATE users SET is_active = ?, updated_at = NOW() WHERE user_id = ? AND tenant_id = ?',
            [(int) $isActive, $userId, Database::tenantId()]
        );

        // ── Session revocation on deactivation ──────────────────────────────
        // When a user is deactivated, immediately invalidate all their active
        // sessions so the mobile app cannot silently refresh and stay logged in.
        if (!$isActive) {
            // 1. Delete all refresh tokens → next token refresh returns 401
            // Safe to scope by user_id alone: $userId was already fetched above
            // with "AND tenant_id = ? [Database::tenantId()]" (line 447), so this
            // user is confirmed to belong to the current tenant before we get here.
            Database::execute(
                'DELETE FROM refresh_tokens WHERE user_id = ?',
                [$userId]
            );
        }
        // Note: existing access tokens for this user will be rejected by
        // AuthMiddleware on the very next API call because it re-checks
        // is_active from the DB on every request.
        // ────────────────────────────────────────────────────────────────────

        Response::success(['user_id' => $userId, 'is_active' => $isActive], 'User status updated');
    }

    // ─── GET /admin/users/{id}/stats ─────────────────────────────────────────
    // Returns per-status order breakdown for a single user.

    public function orderStats(Request $request): void
    {
        $userId = (int) $request->param('id');
        if ($userId <= 0) {
            Response::error('Invalid user ID', 400);
        }

        $user = Database::fetch('SELECT user_id FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1', [$userId, Database::tenantId()]);
        if (!$user) {
            Response::error('User not found', 404);
        }

        // Aggregate order counts by status and total spent in one query
        $rows = Database::fetchAll(
            "SELECT order_status, COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS spent
             FROM orders
             WHERE user_id = ? AND tenant_id = ?
             GROUP BY order_status",
            [$userId, Database::tenantId()]
        );

        // Build a status → count map
        $byStatus = [];
        $totalSpent = 0.0;
        foreach ($rows as $r) {
            $byStatus[strtolower($r['order_status'])] = (int) $r['cnt'];
            $totalSpent += (float) $r['spent'];
        }

        $activeStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'out for delivery'];
        $activeCount = 0;
        foreach ($activeStatuses as $s) {
            $activeCount += $byStatus[$s] ?? 0;
        }

        $totalOrders = array_sum($byStatus);

        Response::success([
            'user_id'          => $userId,
            'total_orders'     => $totalOrders,
            'active_orders'    => $activeCount,
            'delivered_orders' => $byStatus['delivered'] ?? 0,
            'cancelled_orders' => $byStatus['cancelled'] ?? 0,
            'returned_orders'  => $byStatus['returned']  ?? 0,
            'total_spent'      => round($totalSpent, 2),
        ]);
    }

    // ─── DELETE /admin/users/{id} ────────────────────────────────────────────
    // Soft-deactivates the user. Orders and history are preserved.

    public function destroy(Request $request): void
    {
        $userId = (int) $request->param('id');
        if ($userId <= 0) {
            Response::error('Invalid user ID', 400);
        }

        $user = Database::fetch('SELECT user_id, user_type FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1', [$userId, Database::tenantId()]);
        if (!$user) {
            Response::error('User not found', 404);
        }
        if ($user['user_type'] === 'admin') {
            Response::error('Cannot delete an admin account', 403);
        }

        User::deactivate($userId);

        // Revoke all refresh tokens so the mobile app cannot stay logged in.
        // Safe to scope by user_id alone: $userId was already fetched above with
        // "AND tenant_id = ? [Database::tenantId()]" (line 539), so this user is
        // confirmed to belong to the current tenant before we get here.
        Database::execute(
            'DELETE FROM refresh_tokens WHERE user_id = ?',
            [$userId]
        );

        Response::success(null, 'User deactivated successfully');
    }

    // ─── GET /admin/users/{id}/detail ────────────────────────────────────────
    // Full customer master record for the detail drawer: profile fields
    // (address/city/state/pincode/GST/Udyam — all already columns on `users`,
    // previously never surfaced by the frontend), last order date/amount, and
    // the current retention health score if one has been computed.
    public function detail(Request $request): void
    {
        $userId = (int) $request->param('id');
        if ($userId <= 0) {
            Response::error('Invalid user ID', 400);
        }

        $user = Database::fetch(
            'SELECT ' . User::publicFields() . ', last_order_at FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1',
            [$userId, Database::tenantId()]
        );
        if (!$user) {
            Response::error('User not found', 404);
        }
        $user['is_active'] = (bool) $user['is_active'];

        $lastOrder = Database::fetch(
            'SELECT order_id, order_number, total_amount, order_status, delivery_address, delivery_city,
                    delivery_state, delivery_pincode, created_at
             FROM orders
             WHERE user_id = ? AND tenant_id = ?
             ORDER BY created_at DESC, order_id DESC
             LIMIT 1',
            [$userId, Database::tenantId()]
        );

        $health = Database::fetch(
            'SELECT * FROM customer_health_scores WHERE customer_id = ? AND tenant_id = ? LIMIT 1',
            [$userId, Database::tenantId()]
        );

        Response::success([
            'user' => $user,
            'last_order' => $lastOrder ?: null,
            'health' => $health ?: null,
        ]);
    }

    // ─── POST /admin/users/{id}/reset-password ───────────────────────────────
    // Admin-initiated password reset. Generates a new random credential, sets
    // it on the account immediately (the old password stops working), and
    // emails it to the customer via api/helpers/Mailer.php. Always logged to
    // customer_password_resets for support/audit, including delivery outcome.
    public function resetPassword(Request $request): void
    {
        $userId = (int) $request->param('id');
        if ($userId <= 0) {
            Response::error('Invalid user ID', 400);
        }

        $user = Database::fetch(
            'SELECT user_id, name, email, phone, user_type FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1',
            [$userId, Database::tenantId()]
        );
        if (!$user) {
            Response::error('User not found', 404);
        }

        $hasRealEmail = !empty($user['email']) && !str_ends_with((string)$user['email'], '@noemail.kynetropo.local');
        if (!$hasRealEmail) {
            Response::error('This customer has no email on file — add one before resetting the password', 422);
        }

        // Cryptographically random, readable temporary password (10 hex bytes -> 20 chars
        // is overkill for typing; use 6 random bytes -> 12 hex chars, mixed with a prefix).
        $newPassword = 'Tmp' . strtoupper(bin2hex(random_bytes(4)));

        User::updatePassword($userId, $newPassword);

        $tenantCompanyName = self::companyName();
        $title = "Your {$tenantCompanyName} Password Has Been Reset";
        $body = "<p>An administrator reset the password for your account.</p>"
            . "<table cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f9fafb;border-radius:8px;padding:14px 18px;font-size:14px;margin:16px 0;\">"
            . "<tr><td style=\"padding:4px 12px 4px 0;color:#6b7280;\">Login (Phone)</td><td style=\"font-weight:600;font-family:monospace;\">" . htmlspecialchars((string)$user['phone']) . "</td></tr>"
            . "<tr><td style=\"padding:4px 12px 4px 0;color:#6b7280;\">New Password</td><td style=\"font-weight:600;font-family:monospace;\">" . htmlspecialchars($newPassword) . "</td></tr>"
            . "</table>"
            . "<p style=\"color:#6b7280;font-size:12px;\">Please change this password after logging in. If you did not expect this, contact support immediately.</p>";

        $emailSent = Mailer::send($user['email'], $title, Mailer::layout($title, $body));

        try {
            Database::insertTenant('customer_password_resets', [
                'user_id'         => $userId,
                'reset_by'        => (int) ($request->user['user_id'] ?? 0) ?: null,
                'email_sent'      => $emailSent ? 1 : 0,
                'delivery_method' => 'email',
                'ip_address'      => $request->ip(),
                'created_at'      => date('Y-m-d H:i:s'),
            ]);
        } catch (Throwable $e) {
            error_log('Customer password reset audit failed: ' . $e->getMessage());
        }

        // Revoke existing sessions so the old password can't keep a stale
        // refresh token alive after the credential changed.
        Database::execute('DELETE FROM refresh_tokens WHERE user_id = ?', [$userId]);

        if (!$emailSent) {
            // Password WAS reset (the account is now secured); email delivery is a
            // secondary concern. Tell the admin the truth so they can hand the
            // password to the customer manually instead of believing mail went out.
            Response::success([
                'user_id'     => $userId,
                'email_sent'  => false,
                'new_password'=> $newPassword,
            ], 'Password reset, but the email could not be delivered (SMTP not configured or send failed) — share the password shown below with the customer manually', 200);
            return;
        }

        Response::success([
            'user_id'    => $userId,
            'email_sent' => true,
        ], "Password reset and emailed to {$user['email']}");
    }

    /**
     * Get all pending users
     * GET /admin/users/pending
     */
    public function pending(Request $request): void
    {
        try {
            $db = Database::getInstance();

            $query = "
                SELECT
                    user_id,
                    name,
                    email,
                    phone,
                    user_type,
                    company_name,
                    address,
                    city,
                    state,
                    pincode,
                    gst_number,
                    udyam_number,
                    approval_status,
                    created_at
                FROM users
                WHERE tenant_id = ? AND approval_status = 'pending'
                ORDER BY created_at DESC
            ";

            $stmt = $db->prepare($query);
            $stmt->execute([Database::tenantId()]);
            $pendingUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);

            Response::success([
                'users' => $pendingUsers,
                'count' => count($pendingUsers)
            ]);

        } catch (Exception $e) {
            error_log('Error fetching pending users: ' . $e->getMessage());
            Response::error('Failed to fetch pending users', 500);
        }
    }
    /**
     * Approve a user
     * POST /admin/users/{id}/approve
     */
    public function approve(Request $request): void
    {
        try {
            $id = (int) $request->param('id');
            $adminUser = $request->user ?? [];
            $adminId = $adminUser['user_id'] ?? 0;

            $db = Database::getInstance();

            // Get user details
            $userQuery = "SELECT user_id, name, email, approval_status FROM users WHERE user_id = ? AND tenant_id = ?";
            $userStmt = $db->prepare($userQuery);
            $userStmt->execute([$id, Database::tenantId()]);
            $user = $userStmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                Response::error('User not found', 404);
            }

            if ($user['approval_status'] === 'approved') {
                Response::error('User is already approved', 400);
            }

            // Update user status
            $updateQuery = "
                UPDATE users
                SET
                    approval_status = 'approved',
                    is_active = true,
                    approved_at = NOW(),
                    approved_by = ?
                WHERE user_id = ? AND tenant_id = ?
            ";

            $updateStmt = $db->prepare($updateQuery);
            $success = $updateStmt->execute([$adminId, $id, Database::tenantId()]);

            if (!$success) {
                Response::error('Failed to approve user', 500);
            }

            // Send approval email
            require_once ROOT_PATH . '/controllers/AuthController.php';
            $authController = new AuthController();
            $authController->sendApprovalEmail($user['email'], $user['name']);

            Response::success([
                'message' => 'User approved successfully',
                'user_id' => $id
            ]);

        } catch (Exception $e) {
            error_log('Error approving user: ' . $e->getMessage());
            Response::error('Failed to approve user', 500);
        }
    }
    /**
     * Reject a user
     * POST /admin/users/{id}/reject
     */
    public function reject(Request $request): void
    {
        try {
            $id = (int) $request->param('id');
            $reason = trim((string) $request->input('reason', 'No reason provided'));

            if (empty($reason)) {
                Response::error('Rejection reason is required', 400);
            }

            $db = Database::getInstance();

            // Get user details
            $userQuery = "SELECT user_id, name, email, approval_status FROM users WHERE user_id = ? AND tenant_id = ?";
            $userStmt = $db->prepare($userQuery);
            $userStmt->execute([$id, Database::tenantId()]);
            $user = $userStmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                Response::error('User not found', 404);
            }

            if ($user['approval_status'] === 'rejected') {
                Response::error('User is already rejected', 400);
            }

            // Update user status
            $updateQuery = "
                UPDATE users
                SET
                    approval_status = 'rejected',
                    is_active = false,
                    rejection_reason = ?
                WHERE user_id = ? AND tenant_id = ?
            ";

            $updateStmt = $db->prepare($updateQuery);
            $success = $updateStmt->execute([$reason, $id, Database::tenantId()]);

            if (!$success) {
                Response::error('Failed to reject user', 500);
            }

            // Send rejection email
            require_once ROOT_PATH . '/controllers/AuthController.php';
            $authController = new AuthController();
            $authController->sendRejectionEmail($user['email'], $user['name'], $reason);

            Response::success([
                'message' => 'User rejected successfully',
                'user_id' => $id
            ]);

        } catch (Exception $e) {
            error_log('Error rejecting user: ' . $e->getMessage());
            Response::error('Failed to reject user', 500);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Customer health / retention intelligence
    // ════════════════════════════════════════════════════════════════════════
    //
    // RFM-style score (0-100) computed from real order + invoice history so the
    // owner can see who to focus on without manually cross-referencing orders,
    // payments, and ageing reports per customer:
    //   recency_score   (0-30) — days since last order, decayed to 0 by 180d
    //   frequency_score (0-25) — orders in the trailing 12 months
    //   monetary_score  (0-25) — total-spend percentile rank within this tenant
    //   payment_score   (0-20) — penalised by overdue invoice balance/age
    // segment: champion | loyal | at_risk | new | dormant
    // is_at_risk / is_high_value are precomputed booleans for fast list filters.

    // ─── GET /admin/customers/health ─────────────────────────────────────────
    // Tenant-scoped retention dashboard: every customer's current health score
    // plus quick-access at-risk / high-value lists. Pass ?recompute=1 to force
    // a full recalculation first (otherwise serves the last computed snapshot,
    // which is fast for a list page).
    public function customerHealth(Request $request): void
    {
        if (filter_var($request->query('recompute', '0'), FILTER_VALIDATE_BOOLEAN)) {
            self::recomputeAllCustomerHealth();
        }

        $rows = Database::fetchAll(
            'SELECT chs.*, u.name, u.email, u.phone, u.city, u.is_active
             FROM customer_health_scores chs
             JOIN users u ON u.user_id = chs.customer_id AND u.tenant_id = chs.tenant_id
             WHERE chs.tenant_id = ?
             ORDER BY chs.health_score ASC',
            [Database::tenantId()]
        );

        foreach ($rows as &$r) {
            $r['health_score'] = (float) $r['health_score'];
            $r['is_at_risk'] = (bool) $r['is_at_risk'];
            $r['is_high_value'] = (bool) $r['is_high_value'];
            $r['is_active'] = (bool) $r['is_active'];
        }
        unset($r);

        $atRisk = array_values(array_filter($rows, fn($r) => $r['is_at_risk']));
        $highValue = array_values(array_filter($rows, fn($r) => $r['is_high_value']));

        $segments = [];
        foreach ($rows as $r) {
            $segments[$r['segment']] = ($segments[$r['segment']] ?? 0) + 1;
        }

        Response::success([
            'customers' => $rows,
            'at_risk' => $atRisk,
            'high_value' => $highValue,
            'segment_counts' => $segments,
            'computed_customers' => count($rows),
        ]);
    }

    // ─── POST /admin/users/{id}/recompute-health ─────────────────────────────
    // Recompute a single customer's score on demand (e.g. right after viewing
    // their detail drawer, or after an order/payment that should move them
    // out of "at risk").
    public function recomputeHealth(Request $request): void
    {
        $userId = (int) $request->param('id');
        if ($userId <= 0) {
            Response::error('Invalid user ID', 400);
        }

        $user = Database::fetch('SELECT user_id FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1', [$userId, Database::tenantId()]);
        if (!$user) {
            Response::error('User not found', 404);
        }

        $score = self::computeCustomerHealth($userId);
        Response::success($score, 'Customer health score recomputed');
    }

    /** Recompute health scores for every customer in the current tenant. */
    private static function recomputeAllCustomerHealth(): array
    {
        $customers = Database::fetchAll(
            "SELECT user_id FROM users WHERE tenant_id = ? AND user_type = 'customer'",
            [Database::tenantId()]
        );
        $results = [];
        foreach ($customers as $c) {
            $results[] = self::computeCustomerHealth((int) $c['user_id']);
        }
        return $results;
    }

    /**
     * Computes and persists one customer's RFM-style health score from real
     * order + invoice/payment history, then returns the row. Tenant-scoped
     * throughout — every query carries tenant_id (Database::tenantId()).
     */
    private static function computeCustomerHealth(int $customerId): array
    {
        $tenantId = Database::tenantId();

        // ── Order history: recency, frequency, monetary ────────────────────
        $orderStats = Database::fetch(
            "SELECT COUNT(*) AS total_orders,
                    SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) THEN 1 ELSE 0 END) AS orders_last_12m,
                    COALESCE(SUM(total_amount), 0) AS total_spend,
                    MAX(created_at) AS last_order_at,
                    MIN(created_at) AS first_order_at
             FROM orders
             WHERE user_id = ? AND tenant_id = ? AND order_status != 'cancelled'",
            [$customerId, $tenantId]
        ) ?: ['total_orders' => 0, 'orders_last_12m' => 0, 'total_spend' => 0, 'last_order_at' => null, 'first_order_at' => null];

        $totalOrders = (int) $orderStats['total_orders'];
        $ordersLast12m = (int) $orderStats['orders_last_12m'];
        $totalSpend = (float) $orderStats['total_spend'];
        $lastOrderAt = $orderStats['last_order_at'];
        $firstOrderAt = $orderStats['first_order_at'];
        $avgOrderValue = $totalOrders > 0 ? round($totalSpend / $totalOrders, 2) : 0.0;

        $daysSinceLastOrder = $lastOrderAt
            ? (int) floor((time() - strtotime($lastOrderAt)) / 86400)
            : null;
        $daysSinceFirstOrder = $firstOrderAt
            ? (int) floor((time() - strtotime($firstOrderAt)) / 86400)
            : null;

        // ── Overdue exposure: unpaid invoices linked to this customer's orders ──
        $overdue = Database::fetch(
            "SELECT COUNT(*) AS overdue_invoices,
                    COALESCE(SUM(GREATEST(i.total - COALESCE(i.amount_paid, 0), 0)), 0) AS overdue_amount,
                    COALESCE(MAX(DATEDIFF(CURDATE(), COALESCE(i.due_date, i.invoice_date, DATE(i.created_at)))), 0) AS max_days_overdue
             FROM invoices i
             JOIN orders o ON o.order_id = i.order_id AND o.tenant_id = i.tenant_id
             WHERE i.tenant_id = ? AND o.user_id = ?
               AND LOWER(COALESCE(i.payment_status, i.status, 'unpaid')) NOT IN ('paid', 'cancelled', 'refunded')
               AND GREATEST(i.total - COALESCE(i.amount_paid, 0), 0) > 0.005
               AND COALESCE(i.due_date, i.invoice_date, DATE(i.created_at)) < CURDATE()",
            [$tenantId, $customerId]
        ) ?: ['overdue_invoices' => 0, 'overdue_amount' => 0, 'max_days_overdue' => 0];

        $overdueInvoices = (int) $overdue['overdue_invoices'];
        $overdueAmount = (float) $overdue['overdue_amount'];
        $maxDaysOverdue = (int) $overdue['max_days_overdue'];

        // ── Monetary percentile: where this customer's spend ranks among the
        //    tenant's other customers (relative scoring works at any business size) ──
        $spendRank = Database::fetch(
            "SELECT
                (SELECT COUNT(*) FROM (
                    SELECT o2.user_id, SUM(o2.total_amount) AS spend
                    FROM orders o2
                    JOIN users u2 ON u2.user_id = o2.user_id AND u2.tenant_id = o2.tenant_id
                    WHERE o2.tenant_id = ? AND u2.user_type = 'customer' AND o2.order_status != 'cancelled'
                    GROUP BY o2.user_id
                    HAVING spend <= ?
                ) ranked) AS at_or_below,
                (SELECT COUNT(*) FROM (
                    SELECT o3.user_id
                    FROM orders o3
                    JOIN users u3 ON u3.user_id = o3.user_id AND u3.tenant_id = o3.tenant_id
                    WHERE o3.tenant_id = ? AND u3.user_type = 'customer' AND o3.order_status != 'cancelled'
                    GROUP BY o3.user_id
                ) total) AS total_spenders",
            [$tenantId, $totalSpend, $tenantId]
        );
        $totalSpenders = max(1, (int) ($spendRank['total_spenders'] ?? 1));
        $atOrBelow = (int) ($spendRank['at_or_below'] ?? ($totalSpend > 0 ? 1 : 0));
        $monetaryPercentile = $totalSpend > 0 ? $atOrBelow / $totalSpenders : 0.0;

        // ── Component scores ────────────────────────────────────────────────
        // Recency: full marks within 30 days, linear decay to 0 by 180 days, no orders = 0.
        if ($daysSinceLastOrder === null) {
            $recencyScore = 0.0;
        } elseif ($daysSinceLastOrder <= 30) {
            $recencyScore = 30.0;
        } elseif ($daysSinceLastOrder >= 180) {
            $recencyScore = 0.0;
        } else {
            $recencyScore = round(30.0 * (1 - ($daysSinceLastOrder - 30) / 150), 2);
        }

        // Frequency: 12+ orders/yr = full marks, linear below that.
        $frequencyScore = round(min(25.0, ($ordersLast12m / 12.0) * 25.0), 2);

        // Monetary: percentile rank scaled directly to 0-25.
        $monetaryScore = round($monetaryPercentile * 25.0, 2);

        // Payment: start at full 20, penalise by overdue ratio and age.
        $paymentScore = 20.0;
        if ($overdueAmount > 0 && $totalSpend > 0) {
            $overdueRatio = min(1.0, $overdueAmount / max($totalSpend, $overdueAmount));
            $paymentScore -= $overdueRatio * 12.0; // up to -12 for overdue balance size
        }
        if ($maxDaysOverdue > 0) {
            $paymentScore -= min(8.0, ($maxDaysOverdue / 90.0) * 8.0); // up to -8 for how overdue
        }
        $paymentScore = round(max(0.0, $paymentScore), 2);

        $healthScore = round($recencyScore + $frequencyScore + $monetaryScore + $paymentScore, 2);

        // ── Segment classification ──────────────────────────────────────────
        $isNew = $totalOrders > 0 && $totalOrders <= 2 && $daysSinceFirstOrder !== null && $daysSinceFirstOrder <= 60;
        $isDormant = $totalOrders > 0 && ($daysSinceLastOrder === null || $daysSinceLastOrder >= 180);
        $isAtRisk = $totalOrders > 0 && !$isDormant && !$isNew
            && ($healthScore < 50 || $overdueInvoices > 0 || ($daysSinceLastOrder !== null && $daysSinceLastOrder >= 90));
        $isHighValue = $totalOrders > 0 && ($monetaryPercentile >= 0.8 || $healthScore >= 75);

        if ($totalOrders === 0) {
            $segment = 'new';
        } elseif ($isDormant) {
            $segment = 'dormant';
        } elseif ($isAtRisk) {
            $segment = 'at_risk';
        } elseif ($isNew) {
            $segment = 'new';
        } elseif ($healthScore >= 75) {
            $segment = 'champion';
        } elseif ($healthScore >= 55) {
            $segment = 'loyal';
        } else {
            $segment = 'at_risk';
        }
        if ($segment !== 'at_risk') {
            $isAtRisk = false;
        }

        $row = [
            'customer_id' => $customerId,
            'tenant_id' => $tenantId,
            'recency_score' => $recencyScore,
            'frequency_score' => $frequencyScore,
            'monetary_score' => $monetaryScore,
            'payment_score' => $paymentScore,
            'health_score' => $healthScore,
            'segment' => $segment,
            'is_at_risk' => $isAtRisk ? 1 : 0,
            'is_high_value' => $isHighValue ? 1 : 0,
            'total_orders' => $totalOrders,
            'orders_last_12m' => $ordersLast12m,
            'total_spend' => $totalSpend,
            'avg_order_value' => $avgOrderValue,
            'overdue_amount' => $overdueAmount,
            'overdue_invoices' => $overdueInvoices,
            'max_days_overdue' => $maxDaysOverdue,
            'last_order_at' => $lastOrderAt,
            'days_since_last_order' => $daysSinceLastOrder,
        ];

        Database::execute(
            'INSERT INTO customer_health_scores
                (customer_id, tenant_id, recency_score, frequency_score, monetary_score, payment_score,
                 health_score, segment, is_at_risk, is_high_value, total_orders, orders_last_12m, total_spend,
                 avg_order_value, overdue_amount, overdue_invoices, max_days_overdue, last_order_at,
                 days_since_last_order, computed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                recency_score = VALUES(recency_score),
                frequency_score = VALUES(frequency_score),
                monetary_score = VALUES(monetary_score),
                payment_score = VALUES(payment_score),
                health_score = VALUES(health_score),
                segment = VALUES(segment),
                is_at_risk = VALUES(is_at_risk),
                is_high_value = VALUES(is_high_value),
                total_orders = VALUES(total_orders),
                orders_last_12m = VALUES(orders_last_12m),
                total_spend = VALUES(total_spend),
                avg_order_value = VALUES(avg_order_value),
                overdue_amount = VALUES(overdue_amount),
                overdue_invoices = VALUES(overdue_invoices),
                max_days_overdue = VALUES(max_days_overdue),
                last_order_at = VALUES(last_order_at),
                days_since_last_order = VALUES(days_since_last_order),
                computed_at = NOW()',
            [
                $row['customer_id'], $row['tenant_id'], $row['recency_score'], $row['frequency_score'],
                $row['monetary_score'], $row['payment_score'], $row['health_score'], $row['segment'],
                $row['is_at_risk'], $row['is_high_value'], $row['total_orders'], $row['orders_last_12m'],
                $row['total_spend'], $row['avg_order_value'], $row['overdue_amount'], $row['overdue_invoices'],
                $row['max_days_overdue'], $row['last_order_at'], $row['days_since_last_order'],
            ]
        );

        // Keep users.last_order_at denormalised in sync for fast list rendering.
        Database::execute(
            'UPDATE users SET last_order_at = ? WHERE user_id = ? AND tenant_id = ?',
            [$lastOrderAt, $customerId, $tenantId]
        );

        return $row;
    }
}
