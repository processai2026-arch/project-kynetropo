<?php
declare(strict_types=1);

// Require NotificationSettings for notification toggle documentation and examples
require_once __DIR__ . '/../../services/NotificationSettings.php';

/**
 * Admin Settings Controller
 * GET /admin/settings — all settings structured by section
 * PUT /admin/settings — update any section (company / contact / calculator / notifications)
 *
 * Notification Toggles:
 * ─────────────────────
 * The Settings page exposes three notification toggles:
 *   - order_alerts:  Sent when new orders arrive. Gated by NotificationSettings::enabled('order_alerts')
 *   - low_stock:     Sent when inventory falls below threshold. Gated by NotificationSettings::enabled('low_stock')
 *   - new_customer:  Sent when new customers register. Gated by NotificationSettings::enabled('new_customer')
 *
 * To send a notification email, check the toggle first:
 *   if (NotificationSettings::enabled('order_alerts')) {
 *       // send email
 *   }
 *
 * See api/services/NotificationSettings.php for the gate implementation.
 */
class AdminSettingsController
{
    private const FUEL_KEYS = ['lpg', 'diesel', 'coal', 'firewood'];

    private const DOCUMENT_SETTING_KEYS = [
        'pr_prefix', 'pr_padding', 'pr_period_policy',
        'po_prefix', 'po_padding', 'po_period_policy',
        'grn_prefix', 'grn_padding', 'grn_period_policy',
        'quotation_prefix', 'quotation_padding', 'quotation_period_policy',
        'proforma_prefix', 'proforma_padding', 'proforma_period_policy',
        'payment_prefix', 'payment_padding', 'payment_period_policy',
        'adjustment_prefix', 'adjustment_padding', 'adjustment_period_policy',
        'budget_prefix', 'budget_padding', 'budget_period_policy',
        'invoice_prefix', 'invoice_padding', 'invoice_period_policy',
        'order_prefix', 'order_padding', 'order_period_policy',
    ];

    private const ALLOWED_SCALAR = [
        'company_name', 'company_subtitle', 'company_logo', 'company_primary_color', 'gstin',
        'company_email', 'company_phone', 'company_address',
        'company_bank_name', 'company_bank_account', 'company_bank_ifsc', 'company_bank_branch',
        'contact_email', 'contact_phone', 'contact_address',
        'delivery_fee', 'gst_rate',
        'pellet_price', 'conversion_factor',
        'notify_order', 'notify_low_stock', 'notify_new_customer',
        'invoice_prefix', 'order_prefix',
        'pr_prefix', 'pr_padding', 'pr_period_policy',
        'po_prefix', 'po_padding', 'po_period_policy',
        'grn_prefix', 'grn_padding', 'grn_period_policy',
        'quotation_prefix', 'quotation_padding', 'quotation_period_policy',
        'proforma_prefix', 'proforma_padding', 'proforma_period_policy',
        'payment_prefix', 'payment_padding', 'payment_period_policy',
        'adjustment_prefix', 'adjustment_padding', 'adjustment_period_policy',
        'budget_prefix', 'budget_padding', 'budget_period_policy',
        'invoice_padding', 'invoice_period_policy',
        'order_padding', 'order_period_policy',
        'attendance_cutoff_time',
        'attendance_checkout_cutoff_time',
        'attendance_working_days',
    ];

    // ── GET /admin/settings ───────────────────────────────────────────────────

    public function show(Request $request): void
    {
        $rows = Database::fetchAll('SELECT setting_key, setting_value FROM settings WHERE tenant_id = ?', [Database::tenantId()]);
        $map  = [];
        foreach ($rows as $r) {
            $map[$r['setting_key']] = $r['setting_value'];
        }

        $data = [
            // Company profile (per-tenant; used on invoices/quotations/PDFs)
            'store_slug'       => TenantContext::row()['slug'] ?? '',
            'company_name'     => $map['company_name']     ?? '',
            'company_subtitle' => $map['company_subtitle'] ?? '',
            'company_logo'     => $map['company_logo']     ?? '',
            'company_primary_color' => $map['company_primary_color'] ?? '#0f766e',
            'gstin'            => $map['gstin']            ?? '',
            'company_email'    => $map['company_email']    ?? '',
            'company_phone'    => $map['company_phone']    ?? '',
            'company_address'  => $map['company_address']  ?? '',
            'company_bank_name'    => $map['company_bank_name']    ?? '',
            'company_bank_account' => $map['company_bank_account'] ?? '',
            'company_bank_ifsc'    => $map['company_bank_ifsc']    ?? '',
            'company_bank_branch'  => $map['company_bank_branch']  ?? '',

            // Contact Us shown in mobile app
            'contact_email'   => $map['contact_email']   ?? $map['company_email']   ?? '',
            'contact_phone'   => $map['contact_phone']   ?? $map['company_phone']   ?? '',
            'contact_address' => $map['contact_address'] ?? $map['company_address'] ?? '',

            // Finance
            'delivery_fee' => (float)($map['delivery_fee'] ?? 150),
            'gst_rate'     => (float)($map['gst_rate']     ?? 18),

            // Savings calculator
            'pellet_price'      => (float)($map['pellet_price']      ?? 14),
            'conversion_factor' => (float)($map['conversion_factor'] ?? 2.83),
            'fuels' => [
                ['name' => 'LPG',      'unit' => '/kg', 'defaultPrice' => (float)($map['fuel_lpg_price']      ?? 85), 'enabled' => (bool)(int)($map['fuel_lpg_enabled']      ?? 1)],
                ['name' => 'Diesel',   'unit' => '/L',  'defaultPrice' => (float)($map['fuel_diesel_price']   ?? 92), 'enabled' => (bool)(int)($map['fuel_diesel_enabled']   ?? 1)],
                ['name' => 'Coal',     'unit' => '/kg', 'defaultPrice' => (float)($map['fuel_coal_price']     ?? 12), 'enabled' => (bool)(int)($map['fuel_coal_enabled']     ?? 1)],
                ['name' => 'Firewood', 'unit' => '/kg', 'defaultPrice' => (float)($map['fuel_firewood_price'] ?? 8),  'enabled' => (bool)(int)($map['fuel_firewood_enabled'] ?? 1)],
            ],

            // Attendance — daily cutoffs (12-hour AM/PM strings)
            'attendance_cutoff_time'          => $map['attendance_cutoff_time']          ?? '10:30 AM',
            'attendance_checkout_cutoff_time' => $map['attendance_checkout_cutoff_time'] ?? '05:00 PM',
            // Working days — CSV of weekday numbers (0=Sun … 6=Sat); auto-absent skips other days
            'attendance_working_days'         => $map['attendance_working_days']         ?? Attendance::DEFAULT_WORKING_DAYS,

            // Notifications
            'notifications' => [
                'order_alerts'  => (bool)(int)($map['notify_order']        ?? 1),
                'low_stock'     => (bool)(int)($map['notify_low_stock']    ?? 1),
                'new_customer'  => (bool)(int)($map['notify_new_customer'] ?? 0),
            ],

            // Phase 2 document numbering
            'document_numbering' => NumberSequence::settingsSummary($map),
        ];

        Response::success($data);
    }

    // ── PUT /admin/settings ───────────────────────────────────────────────────

    public function update(Request $request): void
    {
        $body = $request->only([
            'company_name', 'company_subtitle', 'company_logo', 'company_primary_color', 'gstin',
            'company_email', 'company_phone', 'company_address',
            'company_bank_name', 'company_bank_account', 'company_bank_ifsc', 'company_bank_branch',
            'contact_email', 'contact_phone', 'contact_address',
            'delivery_fee', 'gst_rate',
            'pellet_price', 'conversion_factor',
            'fuels',
            'notifications',
            'document_numbering',
            'attendance_cutoff_time',
            'attendance_checkout_cutoff_time',
            'attendance_working_days',
            'pr_prefix', 'pr_padding', 'pr_period_policy',
            'po_prefix', 'po_padding', 'po_period_policy',
            'grn_prefix', 'grn_padding', 'grn_period_policy',
            'quotation_prefix', 'quotation_padding', 'quotation_period_policy',
            'proforma_prefix', 'proforma_padding', 'proforma_period_policy',
            'payment_prefix', 'payment_padding', 'payment_period_policy',
            'adjustment_prefix', 'adjustment_padding', 'adjustment_period_policy',
            'budget_prefix', 'budget_padding', 'budget_period_policy',
            'invoice_prefix', 'invoice_padding', 'invoice_period_policy',
            'order_prefix', 'order_padding', 'order_period_policy',
        ]);

        if (empty($body)) {
            Response::error('Provide at least one setting to update', 400);
        }

        foreach ($body as $key => $value) {
            // Handle fuels array
            if ($key === 'fuels' && is_array($value)) {
                foreach ($value as $fuel) {
                    if (!is_array($fuel) || !isset($fuel['name'])) continue;
                    $slug = strtolower((string)$fuel['name']);
                    if (!in_array($slug, self::FUEL_KEYS, true)) continue;
                    if (isset($fuel['defaultPrice'])) {
                        $this->upsert("fuel_{$slug}_price", (string)(float)$fuel['defaultPrice']);
                    }
                    if (isset($fuel['enabled'])) {
                        $this->upsert("fuel_{$slug}_enabled", $fuel['enabled'] ? '1' : '0');
                    }
                }
                continue;
            }

            // Handle notifications object
            if ($key === 'notifications' && is_array($value)) {
                $map = [
                    'order_alerts'  => 'notify_order',
                    'low_stock'     => 'notify_low_stock',
                    'new_customer'  => 'notify_new_customer',
                ];
                foreach ($map as $uiKey => $dbKey) {
                    if (isset($value[$uiKey])) {
                        $this->upsert($dbKey, $value[$uiKey] ? '1' : '0');
                    }
                }
                continue;
            }

            if ($key === 'document_numbering' && is_array($value)) {
                $this->updateDocumentNumbering($value);
                continue;
            }

            // Scalar keys — allowed list guard
            if (!in_array($key, self::ALLOWED_SCALAR, true)) continue;

            if ($key === 'company_logo') {
                $logo = trim((string)$value);
                if ($logo !== '') {
                    if (!preg_match('#^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$#', $logo)) {
                        Response::error('company_logo must be a PNG, JPEG, or WebP data URL', 422);
                    }
                    if (strlen($logo) > 60000) {
                        Response::error('company_logo is too large after processing', 422);
                    }
                }
                $this->upsert($key, $logo);
                continue;
            }

            if ($key === 'company_primary_color') {
                $color = trim((string)$value);
                if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) {
                    Response::error('company_primary_color must be a six-digit hex color', 422);
                }
                $this->upsert($key, strtolower($color));
                continue;
            }

            if (in_array($key, self::DOCUMENT_SETTING_KEYS, true)) {
                $this->upsert($key, $this->normalizeDocumentSetting($key, $value));
                continue;
            }

            // Cutoff times must be valid 12-hour AM/PM strings (e.g. "10:30 AM", "05:00 PM")
            if (in_array($key, ['attendance_cutoff_time', 'attendance_checkout_cutoff_time'], true)) {
                $val = trim((string)$value);
                if (!Attendance::isValidCutoff($val)) {
                    Response::error("$key must be in 12-hour AM/PM format (e.g. \"10:30 AM\")", 422);
                }
                // Normalize: uppercase AM/PM, single space
                $val = preg_replace('/\s+/', ' ', strtoupper($val));
                $this->upsert($key, $val);
                continue;
            }

            // Working days — CSV of weekday numbers (0=Sun … 6=Sat), e.g. "1,2,3,4,5,6"
            if ($key === 'attendance_working_days') {
                // Accept an array of numbers from the UI or a CSV string.
                if (is_array($value)) {
                    $value = implode(',', array_map(static fn($d) => (int)$d, $value));
                }
                $val = trim((string)$value);
                if (!Attendance::isValidWorkingDays($val)) {
                    Response::error("$key must be a comma-separated list of weekday numbers 0–6 (e.g. \"1,2,3,4,5,6\")", 422);
                }
                $this->upsert($key, $val);
                continue;
            }

            $this->upsert($key, (string)$value);
        }

        $this->show($request);
    }

    private function upsert(string $key, string $value): void
    {
        $tenantId = Database::tenantId();
        $existing = Database::fetch(
            'SELECT setting_key FROM settings WHERE tenant_id = ? AND setting_key = ? LIMIT 1',
            [$tenantId, $key]
        );
        if ($existing) {
            Database::execute(
                'UPDATE settings SET setting_value = ? WHERE tenant_id = ? AND setting_key = ?',
                [$value, $tenantId, $key]
            );
            return;
        }
        Database::insertTenant('settings', [
            'setting_key' => $key,
            'setting_value' => $value,
        ]);
    }

    private function updateDocumentNumbering(array $payload): void
    {
        $known = NumberSequence::settingsSummary();

        foreach ($payload as $docType => $config) {
            if (!is_array($config)) {
                continue;
            }

            if (is_int($docType)) {
                $docType = (string)($config['doc_type'] ?? $config['docType'] ?? '');
            }

            $docType = strtoupper(trim((string)$docType));
            if (!isset($known[$docType])) {
                continue;
            }

            $keys = $known[$docType];
            if (array_key_exists('prefix', $config)) {
                $this->upsert($keys['prefix_key'], $this->normalizeDocumentSetting($keys['prefix_key'], $config['prefix']));
            }
            if (array_key_exists('padding', $config)) {
                $this->upsert($keys['padding_key'], $this->normalizeDocumentSetting($keys['padding_key'], $config['padding']));
            }
            if (array_key_exists('period_policy', $config) || array_key_exists('periodPolicy', $config)) {
                $policy = $config['period_policy'] ?? $config['periodPolicy'];
                $this->upsert($keys['period_key'], $this->normalizeDocumentSetting($keys['period_key'], $policy));
            }
        }
    }

    private function normalizeDocumentSetting(string $key, mixed $value): string
    {
        if (str_ends_with($key, '_padding')) {
            $padding = (int)$value;
            if ($padding < 2 || $padding > 8) {
                Response::error("$key must be between 2 and 8", 422);
            }
            return (string)$padding;
        }

        if (str_ends_with($key, '_period_policy')) {
            $policy = strtolower(trim((string)$value));
            if (!in_array($policy, NumberSequence::validPeriodPolicies(), true)) {
                Response::error("$key must be one of: " . implode(', ', NumberSequence::validPeriodPolicies()), 422);
            }
            return $policy;
        }

        $prefix = preg_replace('/[^A-Z0-9]/', '', strtoupper(trim((string)$value))) ?: '';
        if ($prefix === '') {
            Response::error("$key must contain at least one letter or number", 422);
        }

        return substr($prefix, 0, 12);
    }
}
