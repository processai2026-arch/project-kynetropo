<?php
declare(strict_types=1);

/**
 * Admin Dropdown Options Controller
 * GET  /admin/dropdown-options/{key}  — fetch options for a named dropdown
 * POST /admin/dropdown-options/{key}  — add a new option value
 * DELETE /admin/dropdown-options/{key}/{value} — remove a custom option
 *
 * Options are stored in the `settings` table as JSON arrays under the key:
 *   dropdown_options_{key}  e.g.  dropdown_options_marketplace
 *
 * Built-in defaults are merged with tenant-added custom values.
 * Deleting a built-in default is not allowed — only custom values can be deleted.
 */
class AdminDropdownOptionsController
{
    // NOTE: private const requires PHP 7.1+. Using a private static method with a
    // static local variable is compatible with PHP 5.3+ and avoids parse errors on
    // hosts running older PHP versions.
    private static function builtInMap(): array
    {
        static $map = [
            'marketplace'        => ['amazon', 'flipkart', 'meesho', 'other'],
            'customer_type'      => ['b2b', 'b2c'],
            'invoice_type'       => ['sale', 'purchase', 'return', 'commission'],
            'vendor_type'        => ['manufacturer', 'distributor', 'wholesaler', 'retailer', 'importer', 'other'],
            'expense_category'   => ['Shipping', 'Marketplace Commission', 'Packaging', 'Advertising', 'Other'],
            'product_category'   => ['Electronics', 'Clothing', 'Accessories', 'Books', 'Home', 'Other'],
            'product_unit'       => ['pcs', 'kg', 'g', 'L', 'mL', 'box', 'pair', 'set', 'roll', 'sheet'],
            'payment_method'     => ['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other'],
            'statement_type'     => ['sales', 'purchase', 'all'],
            'settlement_status'  => ['pending', 'received', 'disputed'],
            'invoice_status'     => ['pending', 'processing', 'review', 'approved', 'rejected', 'error'],
            'order_status'       => ['completed', 'pending', 'cancelled', 'returned'],
            'expense_marketplace' => ['amazon', 'flipkart', 'meesho', 'other', 'none'],
            // General module keys
            'expense_payment_mode'  => ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'],
            'general_expense_category' => ['Office Stationery', 'Employee Welfare', 'Rent', 'Fuel & Transport',
                                            'Food & Hospitality', 'Maintenance & Repairs', 'Professional Services',
                                            'IT & Software', 'Miscellaneous', 'Other'],
            'employee_department'   => ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations',
                                        'Warehouse', 'Customer Support', 'Management', 'Other'],
            'crm_lead_source'       => ['Website', 'Referral', 'Cold Call', 'Social Media', 'Exhibition',
                                        'Advertisement', 'Email Campaign', 'Walk-in', 'Other'],
            'product_catalog_category' => ['Electronics', 'Clothing', 'Accessories', 'Books', 'Home',
                                            'Sports', 'Toys', 'Food', 'Health', 'Other'],
            'inventory_unit'        => ['pcs', 'kg', 'g', 'L', 'mL', 'box', 'pair', 'set', 'roll', 'sheet',
                                        'mt', 'ft', 'cm', 'dozen', 'bag', 'carton'],
            'invoice_payment_status' => ['paid', 'unpaid', 'partial', 'overdue', 'refunded'],
            'indian_state'           => ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
                                         'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
                                         'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
                                         'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
                                         'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
                                         'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
                                         'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry'],
        ];
        return $map;
    }

    private function settingKey(string $key): string
    {
        return 'dropdown_options_' . preg_replace('/[^a-z0-9_]/', '', strtolower($key));
    }

    private function builtIn(string $key): array
    {
        return self::builtInMap()[$key] ?? [];
    }

    private function custom(string $key): array
    {
        $tid      = Database::tenantId();
        $sKey     = $this->settingKey($key);
        $row      = Database::fetch('SELECT setting_value FROM settings WHERE setting_key = ? AND tenant_id = ? LIMIT 1', [$sKey, $tid]);
        if (!$row || !$row['setting_value']) return [];
        $decoded = json_decode((string)$row['setting_value'], true);
        return is_array($decoded) ? $decoded : [];
    }

    private function saveCustom(string $key, array $values): void
    {
        $tid  = Database::tenantId();
        $sKey = $this->settingKey($key);
        $json = json_encode(array_values($values), JSON_UNESCAPED_UNICODE);
        $existing = Database::fetch('SELECT setting_key FROM settings WHERE setting_key = ? AND tenant_id = ? LIMIT 1', [$sKey, $tid]);
        if ($existing) {
            Database::execute('UPDATE settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ? AND tenant_id = ?', [$json, $sKey, $tid]);
        } else {
            Database::insert('INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES (?, ?, ?)', [$tid, $sKey, $json]);
        }
    }

    // GET /admin/dropdown-options/{key}
    public function index(Request $request): void
    {
        $key     = $request->param('key');
        $builtIn = $this->builtIn($key);
        $custom  = $this->custom($key);
        // Merge: built-in first, then custom additions (deduplicated, case-insensitive)
        $seen = [];
        $all  = [];
        foreach (array_merge($builtIn, $custom) as $v) {
            $lower = strtolower(trim((string)$v));
            if ($lower === '' || isset($seen[$lower])) continue;
            $seen[$lower] = true;
            $all[] = ['value' => trim((string)$v), 'is_custom' => !in_array(trim((string)$v), $builtIn, true)];
        }
        Response::success(['key' => $key, 'options' => $all]);
    }

    // POST /admin/dropdown-options/{key}  body: { value: "New Option" }
    public function store(Request $request): void
    {
        $key   = $request->param('key');
        $value = trim((string)($request->input('value') ?? ''));
        if ($value === '' || strlen($value) > 100) {
            Response::error('value is required and must be at most 100 characters', 422);
        }
        $value = Request::sanitize($value);
        // Don't add if already in built-ins
        $builtIn = $this->builtIn($key);
        $existing = $this->custom($key);
        $allLower = array_map('strtolower', array_merge($builtIn, $existing));
        if (in_array(strtolower($value), $allLower, true)) {
            // Already exists — return success (idempotent)
            $builtIn2 = $this->builtIn($key);
            $custom2  = $this->custom($key);
            $all = [];
            $seen = [];
            foreach (array_merge($builtIn2, $custom2) as $v) {
                $lower = strtolower(trim((string)$v));
                if ($lower === '' || isset($seen[$lower])) continue;
                $seen[$lower] = true;
                $all[] = ['value' => trim((string)$v), 'is_custom' => !in_array(trim((string)$v), $builtIn2, true)];
            }
            Response::success(['key' => $key, 'options' => $all, 'added' => false]);
        }
        $updated = [...$existing, $value];
        $this->saveCustom($key, $updated);
        // Return full updated list
        $this->index($request);
    }

    // DELETE /admin/dropdown-options/{key}/{value}
    public function destroy(Request $request): void
    {
        $key   = $request->param('key');
        $value = urldecode((string)$request->param('value'));
        // Cannot delete built-in values
        if (in_array($value, $this->builtIn($key), true)) {
            Response::error('Built-in options cannot be deleted', 422);
        }
        $existing = $this->custom($key);
        $updated  = array_values(array_filter($existing, fn($v) => strtolower($v) !== strtolower($value)));
        $this->saveCustom($key, $updated);
        Response::success(null, 'Option removed');
    }
}
