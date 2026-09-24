<?php
declare(strict_types=1);

/**
 * Admin Expense Controller
 *
 * Endpoints
 * ─────────
 *   GET    /admin/expenses                 — list (filterable + paginated)
 *   GET    /admin/expenses/{id}            — fetch a single expense
 *   POST   /admin/expenses                 — create
 *   PUT    /admin/expenses/{id}            — update
 *   DELETE /admin/expenses/{id}            — delete (hard)
 *   GET    /admin/expenses/categories      — distinct category list for dropdowns
 *   GET    /admin/expenses/claims           — list employee expense claims
 *   GET    /admin/expenses/claims/policies  — category policy limits
 *   GET    /admin/expenses/claims/{id}      — fetch a claim with lines
 *   POST   /admin/expenses/claims           — submit a pending claim
 *   POST   /admin/expenses/claims/{id}/approve   — approve a pending claim
 *   POST   /admin/expenses/claims/{id}/reject    — reject a pending claim
 *   POST   /admin/expenses/claims/{id}/reimburse — mark an approved claim reimbursed
 */
class AdminExpenseController
{
    private const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'];
    private const CLAIM_STATUSES = ['pending', 'approved', 'rejected', 'reimbursed'];
    private const CLAIM_CATEGORY_LIMITS = [
        'Office Stationery' => 5000.00,
        'Employee Welfare' => 5000.00,
        'Maintenance Spares' => 10000.00,
        'Rent' => 25000.00,
        'Raw Materials - Wood Powder' => 25000.00,
        'Raw Materials - Nappier Grass' => 25000.00,
        'Raw Materials - Wood Bark' => 25000.00,
        'Raw Materials - Cotton Stalk' => 25000.00,
        'Raw Materials - Corn Cob' => 25000.00,
        'Fuel & Transport' => 5000.00,
        'Food & Hospitality' => 1500.00,
        'Maintenance & Repairs' => 10000.00,
        'Professional Services' => 25000.00,
        'IT & Software' => 10000.00,
        'Miscellaneous' => 3000.00,
        'Other' => 3000.00,
    ];
    private const DEFAULT_CLAIM_CATEGORY_LIMIT = 5000.00;

    // ─── GET /admin/expenses ─────────────────────────────────────────────────
    public function index(Request $request): void
    {
        $page  = max(1, (int)$request->query('page', 1));
        $limit = min(500, max(1, (int)$request->query('limit', 500)));

        $where  = ['tenant_id = ?'];
        $params = [Database::tenantId()];

        if ($cat = $request->query('category')) {
            $where[]  = 'category = ?';
            $params[] = $cat;
        }
        if ($vendor = $request->query('vendor')) {
            $where[]  = 'vendor LIKE ?';
            $params[] = '%' . $vendor . '%';
        }
        if ($mode = $request->query('payment_mode')) {
            $where[]  = 'payment_mode = ?';
            $params[] = $mode;
        }
        if ($from = $request->query('from')) {
            $where[]  = 'expense_date >= ?';
            $params[] = $from;
        }
        if ($to = $request->query('to')) {
            $where[]  = 'expense_date <= ?';
            $params[] = $to;
        }
        if ($search = $request->query('search')) {
            $like     = '%' . trim($search) . '%';
            $where[]  = '(vendor LIKE ? OR description LIKE ? OR expense_code LIKE ?)';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereClause = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM expenses WHERE $whereClause", $params);
        $offset = ($page - 1) * $limit;

        $rows = Database::fetchAll(
            "SELECT expense_id, expense_code, expense_date, category, vendor, description,
                    amount, payment_mode, bill_url, created_by, created_at, updated_at
             FROM expenses
             WHERE $whereClause
             ORDER BY expense_date DESC, expense_id DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );

        foreach ($rows as &$r) {
            $r['amount'] = (float)$r['amount'];
        }

        Response::paginated($rows, [
            'page'        => $page,
            'limit'       => $limit,
            'total'       => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }

    // ─── GET /admin/expenses/{id} ────────────────────────────────────────────
    public function show(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid expense ID', 400);
        }

        $row = Database::fetch('SELECT * FROM expenses WHERE expense_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        if (!$row) {
            Response::error('Expense not found', 404);
        }
        $row['amount'] = (float)$row['amount'];
        Response::success($row);
    }

    // ─── GET /admin/expenses/categories ──────────────────────────────────────
    public function categories(Request $request): void
    {
        $rows = Database::fetchAll('SELECT DISTINCT category FROM expenses WHERE tenant_id = ? ORDER BY category ASC', [Database::tenantId()]);
        Response::success(array_column($rows, 'category'));
    }

    // ─── GET /admin/expenses/claims ──────────────────────────────────────────
    public function claimIndex(Request $request): void
    {
        $page = max(1, (int)$request->query('page', 1));
        $limit = min(500, max(1, (int)$request->query('limit', 500)));
        $where = ['c.tenant_id = ?'];
        $params = [Database::tenantId()];

        $status = trim((string)$request->query('status', ''));
        if ($status !== '') {
            if (!in_array($status, self::CLAIM_STATUSES, true)) {
                Response::error('Invalid claim status', 422);
            }
            $where[] = 'c.status = ?';
            $params[] = $status;
        }

        $employeeKey = trim((string)$request->query('employee_key', ''));
        if ($employeeKey !== '') {
            $where[] = 'c.employee_key = ?';
            $params[] = $employeeKey;
        }

        $search = trim((string)$request->query('search', ''));
        if ($search !== '') {
            $like = '%' . $search . '%';
            $where[] = '(c.claim_number LIKE ? OR c.purpose LIKE ? OR e.name LIKE ? OR c.employee_key LIKE ?)';
            array_push($params, $like, $like, $like, $like);
        }

        $whereClause = implode(' AND ', $where);
        $total = Database::count(
            "SELECT COUNT(*) AS cnt
             FROM expense_claims c
             LEFT JOIN employees e ON e.employee_key = c.employee_key AND e.tenant_id = c.tenant_id
             WHERE $whereClause",
            $params
        );

        $rows = Database::fetchAll(
            "SELECT c.*,
                    e.name AS employee_name,
                    submitter.name AS submitted_by_name,
                    approver.name AS approved_by_name,
                    rejector.name AS rejected_by_name,
                    reimburser.name AS reimbursed_by_name
             FROM expense_claims c
             LEFT JOIN employees e ON e.employee_key = c.employee_key AND e.tenant_id = c.tenant_id
             LEFT JOIN users submitter ON submitter.user_id = c.claimant_user_id AND submitter.tenant_id = c.tenant_id
             LEFT JOIN users approver ON approver.user_id = c.approved_by AND approver.tenant_id = c.tenant_id
             LEFT JOIN users rejector ON rejector.user_id = c.rejected_by AND rejector.tenant_id = c.tenant_id
             LEFT JOIN users reimburser ON reimburser.user_id = c.reimbursed_by AND reimburser.tenant_id = c.tenant_id
             WHERE $whereClause
             ORDER BY c.submitted_at DESC, c.claim_id DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );

        foreach ($rows as &$row) {
            $row = $this->formatClaim($row, true);
        }

        Response::paginated($rows, [
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }

    // ─── GET /admin/expenses/claims/policies ─────────────────────────────────
    public function claimPolicies(Request $request): void
    {
        Response::success([
            'category_limits' => self::CLAIM_CATEGORY_LIMITS,
            'default_limit' => self::DEFAULT_CLAIM_CATEGORY_LIMIT,
            'mode' => 'warning',
        ]);
    }

    // ─── GET /admin/expenses/claims/{id} ─────────────────────────────────────
    public function claimShow(Request $request): void
    {
        Response::success($this->claimOrFail((int)$request->param('id'), true));
    }

    // ─── POST /admin/expenses/claims ─────────────────────────────────────────
    public function claimStore(Request $request): void
    {
        $employeeKey = trim((string)$request->input('employee_key', ''));
        $purpose = trim((string)$request->input('purpose', ''));
        if ($employeeKey === '') {
            Response::error('employee_key is required', 422);
        }
        if ($purpose === '' || strlen($purpose) > 500) {
            Response::error('purpose is required and must be at most 500 characters', 422);
        }

        $employee = Database::fetch(
            'SELECT employee_key FROM employees WHERE employee_key = ? AND is_active = 1 AND tenant_id = ? LIMIT 1',
            [$employeeKey, Database::tenantId()]
        );
        if (!$employee) {
            Response::error('Active employee not found', 422);
        }

        $items = $this->claimItemsPayload($request->input('items', []));
        $total = round(array_sum(array_column($items, 'amount')), 2);
        $hasPolicyWarnings = count(array_filter($items, fn(array $item): bool => $item['policy_warning'] === 1)) > 0;
        $actorId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;

        Database::beginTransaction();
        try {
            $temporaryNumber = 'TMP-' . strtoupper(bin2hex(random_bytes(8)));
            $claimId = Database::insertTenant('expense_claims', [
                'claim_number' => $temporaryNumber,
                'employee_key' => $employeeKey,
                'claimant_user_id' => $actorId,
                'purpose' => Request::sanitize($purpose),
                'total_amount' => $total,
                'status' => 'pending',
                'has_policy_warnings' => $hasPolicyWarnings ? 1 : 0,
                'submitted_at' => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            $claimNumber = 'CLM-' . str_pad((string)$claimId, 6, '0', STR_PAD_LEFT);
            Database::execute(
                'UPDATE expense_claims SET claim_number = ? WHERE claim_id = ? AND tenant_id = ?',
                [$claimNumber, $claimId, Database::tenantId()]
            );

            foreach ($items as $index => $item) {
                Database::insertTenant('expense_claim_items', [
                    'claim_id' => $claimId,
                    'expense_date' => $item['expense_date'],
                    'category' => $item['category'],
                    'description' => $item['description'],
                    'amount' => $item['amount'],
                    'receipt_url' => $item['receipt_url'],
                    'policy_limit' => $item['policy_limit'],
                    'policy_warning' => $item['policy_warning'],
                    'sort_order' => $index,
                    'created_at' => date('Y-m-d H:i:s'),
                ]);
            }
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            error_log('Expense claim create error: ' . $e->getMessage());
            Response::error('Could not submit expense claim', 500);
        }

        Response::success($this->claimOrFail($claimId, true), 'Expense claim submitted', 201);
    }

    // ─── POST /admin/expenses/claims/{id}/approve ────────────────────────────
    public function claimApprove(Request $request): void
    {
        $note = trim((string)$request->input('reason', ''));
        if (strlen($note) > 500) {
            Response::error('Approval reason must be at most 500 characters', 422);
        }
        $this->claimTransition($request, 'pending', 'approved', $note);
    }

    // ─── POST /admin/expenses/claims/{id}/reject ─────────────────────────────
    public function claimReject(Request $request): void
    {
        $reason = trim((string)$request->input('reason', ''));
        if ($reason === '' || strlen($reason) > 500) {
            Response::error('Rejection reason is required and must be at most 500 characters', 422);
        }
        $this->claimTransition($request, 'pending', 'rejected', $reason);
    }

    // ─── POST /admin/expenses/claims/{id}/reimburse ──────────────────────────
    public function claimReimburse(Request $request): void
    {
        $date = trim((string)$request->input('reimbursement_date', ''));
        $reference = trim((string)$request->input('reimbursement_reference', ''));
        self::validateClaimDate($date, 'reimbursement_date');
        if ($reference === '' || strlen($reference) > 120) {
            Response::error('reimbursement_reference is required and must be at most 120 characters', 422);
        }

        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid claim ID', 400);
        }
        $actorId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;

        Database::beginTransaction();
        try {
            $claim = $this->claimRowForUpdate($id);
            if ($claim['status'] !== 'approved') {
                throw new UnexpectedValueException('Only approved claims can be reimbursed');
            }
            Database::execute(
                'UPDATE expense_claims
                 SET status = ?, reimbursed_by = ?, reimbursed_at = NOW(),
                     reimbursement_date = ?, reimbursement_reference = ?, updated_at = NOW()
                 WHERE claim_id = ? AND tenant_id = ?',
                [
                    'reimbursed',
                    $actorId,
                    $date,
                    Request::sanitize($reference),
                    $id,
                    Database::tenantId(),
                ]
            );
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            if ($e instanceof UnexpectedValueException) {
                Response::error($e->getMessage(), 409);
            }
            if ($e instanceof RuntimeException) {
                Response::error($e->getMessage(), 404);
            }
            error_log('Expense claim reimbursement error: ' . $e->getMessage());
            Response::error('Could not reimburse expense claim', 500);
        }

        Response::success($this->claimOrFail($id, true), 'Expense claim marked reimbursed');
    }

    // ─── POST /admin/expenses ────────────────────────────────────────────────
    public function store(Request $request): void
    {
        Validator::make(
            $request->only(['expense_date', 'category', 'vendor', 'amount', 'payment_mode']),
            [
                'expense_date' => 'required|string|max:10',
                'category'     => 'required|string|min:2|max:80',
                'vendor'       => 'required|string|min:2|max:150',
                'amount'       => 'required|numeric',
                'payment_mode' => 'required|string|max:20',
            ]
        )->validate();

        self::validateDate($request->input('expense_date'));
        self::validateAmount($request->input('amount'));
        self::validatePaymentMode((string)$request->input('payment_mode'));

        $count      = Database::count('SELECT COUNT(*) AS cnt FROM expenses WHERE tenant_id = ?', [Database::tenantId()]);
        $code       = 'EXP-' . str_pad((string)($count + 1), 4, '0', STR_PAD_LEFT);
        $createdBy  = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;

        $expenseId = Database::insert(
            'INSERT INTO expenses
                (tenant_id, expense_code, expense_date, category, vendor, description, amount, payment_mode, bill_url, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [
                Database::tenantId(),
                $code,
                $request->input('expense_date'),
                Request::sanitize((string)$request->input('category')),
                Request::sanitize((string)$request->input('vendor')),
                $request->input('description') ? Request::sanitize((string)$request->input('description')) : null,
                (float)$request->input('amount'),
                (string)$request->input('payment_mode'),
                $request->input('bill_url') ?: null,
                $createdBy,
            ]
        );

        $row = Database::fetch('SELECT * FROM expenses WHERE expense_id = ? AND tenant_id = ? LIMIT 1', [$expenseId, Database::tenantId()]);
        $row['amount'] = (float)$row['amount'];
        Response::success($row, 'Expense created successfully', 201);
    }

    // ─── PUT /admin/expenses/{id} ────────────────────────────────────────────
    public function update(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid expense ID', 400);
        }

        $existing = Database::fetch('SELECT expense_id FROM expenses WHERE expense_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        if (!$existing) {
            Response::error('Expense not found', 404);
        }

        $input = $request->only(['expense_date', 'category', 'vendor', 'description', 'amount', 'payment_mode', 'bill_url']);
        if (empty($input)) {
            Response::error('Provide at least one field to update', 400);
        }

        if (isset($input['expense_date'])) self::validateDate($input['expense_date']);
        if (isset($input['amount']))       self::validateAmount($input['amount']);
        if (isset($input['payment_mode'])) self::validatePaymentMode((string)$input['payment_mode']);
        if (isset($input['category']) && strlen(trim((string)$input['category'])) < 2) {
            Response::error('Category must be at least 2 characters', 422);
        }
        if (isset($input['vendor']) && strlen(trim((string)$input['vendor'])) < 2) {
            Response::error('Vendor must be at least 2 characters', 422);
        }

        $sets   = [];
        $params = [];
        foreach ($input as $col => $val) {
            $sets[]   = "$col = ?";
            $params[] = in_array($col, ['category', 'vendor', 'description'], true) && $val !== null
                ? Request::sanitize((string)$val)
                : $val;
        }
        $sets[] = 'updated_at = NOW()';
        $params[] = $id;
        $params[] = Database::tenantId();

        Database::execute(
            'UPDATE expenses SET ' . implode(', ', $sets) . ' WHERE expense_id = ? AND tenant_id = ?',
            $params
        );

        $row = Database::fetch('SELECT * FROM expenses WHERE expense_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        $row['amount'] = (float)$row['amount'];
        Response::success($row, 'Expense updated successfully');
    }

    // ─── DELETE /admin/expenses/{id} ─────────────────────────────────────────
    public function destroy(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid expense ID', 400);
        }

        $existing = Database::fetch('SELECT expense_id FROM expenses WHERE expense_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        if (!$existing) {
            Response::error('Expense not found', 404);
        }

        Database::execute('DELETE FROM expenses WHERE expense_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        Response::success(null, 'Expense deleted successfully');
    }

    private function claimTransition(Request $request, string $from, string $to, string $reason): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0) {
            Response::error('Invalid claim ID', 400);
        }
        $actorId = isset($request->user['user_id']) ? (int)$request->user['user_id'] : null;

        Database::beginTransaction();
        try {
            $claim = $this->claimRowForUpdate($id);
            if ($claim['status'] !== $from) {
                throw new UnexpectedValueException("Expense claim must be {$from} before it can become {$to}");
            }

            if ($to === 'approved') {
                Database::execute(
                    'UPDATE expense_claims
                     SET status = ?, approved_by = ?, approved_at = NOW(), approval_note = ?, updated_at = NOW()
                     WHERE claim_id = ? AND tenant_id = ?',
                    [$to, $actorId, $reason !== '' ? Request::sanitize($reason) : null, $id, Database::tenantId()]
                );
            } else {
                Database::execute(
                    'UPDATE expense_claims
                     SET status = ?, rejected_by = ?, rejected_at = NOW(), rejection_reason = ?, updated_at = NOW()
                     WHERE claim_id = ? AND tenant_id = ?',
                    [$to, $actorId, Request::sanitize($reason), $id, Database::tenantId()]
                );
            }
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            if ($e instanceof UnexpectedValueException) {
                Response::error($e->getMessage(), 409);
            }
            if ($e instanceof RuntimeException) {
                Response::error($e->getMessage(), 404);
            }
            error_log('Expense claim transition error: ' . $e->getMessage());
            Response::error('Could not update expense claim status', 500);
        }

        Response::success($this->claimOrFail($id, true), "Expense claim {$to}");
    }

    private function claimRowForUpdate(int $id): array
    {
        $row = Database::fetch(
            'SELECT * FROM expense_claims WHERE claim_id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE',
            [$id, Database::tenantId()]
        );
        if (!$row) {
            throw new RuntimeException('Expense claim not found');
        }
        return $row;
    }

    private function claimOrFail(int $id, bool $withItems): array
    {
        if ($id <= 0) {
            Response::error('Invalid claim ID', 400);
        }
        $row = Database::fetch(
            "SELECT c.*,
                    e.name AS employee_name,
                    submitter.name AS submitted_by_name,
                    approver.name AS approved_by_name,
                    rejector.name AS rejected_by_name,
                    reimburser.name AS reimbursed_by_name
             FROM expense_claims c
             LEFT JOIN employees e ON e.employee_key = c.employee_key AND e.tenant_id = c.tenant_id
             LEFT JOIN users submitter ON submitter.user_id = c.claimant_user_id AND submitter.tenant_id = c.tenant_id
             LEFT JOIN users approver ON approver.user_id = c.approved_by AND approver.tenant_id = c.tenant_id
             LEFT JOIN users rejector ON rejector.user_id = c.rejected_by AND rejector.tenant_id = c.tenant_id
             LEFT JOIN users reimburser ON reimburser.user_id = c.reimbursed_by AND reimburser.tenant_id = c.tenant_id
             WHERE c.claim_id = ? AND c.tenant_id = ?
             LIMIT 1",
            [$id, Database::tenantId()]
        );
        if (!$row) {
            Response::error('Expense claim not found', 404);
        }
        return $this->formatClaim($row, $withItems);
    }

    private function formatClaim(array $row, bool $withItems): array
    {
        $row['claim_id'] = (int)$row['claim_id'];
        $row['total_amount'] = (float)$row['total_amount'];
        $row['has_policy_warnings'] = (bool)$row['has_policy_warnings'];
        if (!$withItems) {
            return $row;
        }

        $items = Database::fetchAll(
            'SELECT * FROM expense_claim_items WHERE claim_id = ? AND tenant_id = ? ORDER BY sort_order ASC, item_id ASC',
            [(int)$row['claim_id'], Database::tenantId()]
        );
        foreach ($items as &$item) {
            $item['item_id'] = (int)$item['item_id'];
            $item['amount'] = (float)$item['amount'];
            $item['policy_limit'] = (float)$item['policy_limit'];
            $item['policy_warning'] = (bool)$item['policy_warning'];
        }
        $row['items'] = $items;
        return $row;
    }

    private function claimItemsPayload(mixed $value): array
    {
        if (!is_array($value) || count($value) < 1) {
            Response::error('items must contain at least one expense line', 422);
        }
        if (count($value) > 50) {
            Response::error('A claim can contain at most 50 expense lines', 422);
        }

        $items = [];
        $categoryTotals = [];
        foreach ($value as $index => $raw) {
            if (!is_array($raw)) {
                Response::error('Each claim item must be an object', 422);
            }
            $date = trim((string)($raw['expense_date'] ?? ''));
            $category = trim((string)($raw['category'] ?? ''));
            $description = trim((string)($raw['description'] ?? ''));
            $amount = $raw['amount'] ?? null;
            $receipt = trim((string)($raw['receipt_url'] ?? ''));

            self::validateClaimDate($date, 'items[' . $index . '].expense_date');
            if ($category === '' || strlen($category) > 80) {
                Response::error('Each item category is required and must be at most 80 characters', 422);
            }
            if ($description === '' || strlen($description) > 500) {
                Response::error('Each item description is required and must be at most 500 characters', 422);
            }
            self::validateAmount($amount);
            if ($receipt !== '' && strlen($receipt) > 8 * 1024 * 1024) {
                Response::error('Each receipt must be at most 8MB', 422);
            }

            $policyCategory = $category;
            $items[] = [
                'expense_date' => $date,
                'category' => Request::sanitize($category),
                'policy_category' => $policyCategory,
                'description' => Request::sanitize($description),
                'amount' => round((float)$amount, 2),
                'receipt_url' => $receipt !== '' ? $receipt : null,
            ];
            $categoryTotals[$policyCategory] = ($categoryTotals[$policyCategory] ?? 0) + (float)$amount;
        }

        foreach ($items as &$item) {
            $limit = self::CLAIM_CATEGORY_LIMITS[$item['policy_category']] ?? self::DEFAULT_CLAIM_CATEGORY_LIMIT;
            $item['policy_limit'] = $limit;
            $item['policy_warning'] = $categoryTotals[$item['policy_category']] > $limit ? 1 : 0;
            unset($item['policy_category']);
        }
        return $items;
    }

    private static function validateClaimDate(string $value, string $field): void
    {
        $date = DateTime::createFromFormat('Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) {
            Response::error("{$field} must be a valid YYYY-MM-DD date", 422);
        }
    }

    // ─── Validation helpers ─────────────────────────────────────────────────
    private static function validateDate($val): void
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$val) || !strtotime((string)$val)) {
            Response::error('expense_date must be a valid YYYY-MM-DD date', 422);
        }
    }

    private static function validateAmount($val): void
    {
        if (!is_numeric($val) || (float)$val <= 0) {
            Response::error('amount must be a positive number', 422);
        }
        if ((float)$val > 10_000_000) {
            Response::error('amount exceeds maximum allowed (₹1 crore)', 422);
        }
    }

    private static function validatePaymentMode(string $val): void
    {
        if (!in_array($val, self::PAYMENT_MODES, true)) {
            Response::error('payment_mode must be one of: ' . implode(', ', self::PAYMENT_MODES), 422);
        }
    }

    // ─── POST /admin/expenses/extract-bill ───────────────────────────────────
    /**
     * Accepts { image: "data:image/...;base64,..." }
     * Tries Gemini 1.5 Flash first; if quota exceeded (429) falls back to a
     * structured prompt that the frontend will re-try with Tesseract.js.
     * Returns { date, vendor, amount, category, description, fallback: bool }
     */
    public function extractBill(Request $request): void
    {
        $imageData = $request->input('image');
        if (!$imageData) {
            Response::error('image is required', 422);
        }

        // Detect MIME type from data URI
        preg_match('/^data:(image\/[a-z]+);base64,/i', (string)$imageData, $m);
        $mimeType = $m[1] ?? 'image/jpeg';

        $apiKey = GROQ_API_KEY;
        if (!$apiKey) {
            Response::error('Groq API key not configured', 503);
        }

        $prompt = <<<'PROMPT'
You are a bill/receipt parser for an Indian business expense management system.
Extract the following fields from the bill image and return ONLY a valid JSON object with no extra text or markdown:
{
  "date": "YYYY-MM-DD or empty string",
  "vendor": "shop/vendor/company name or empty string",
  "amount": <number: the final GRAND TOTAL or NET PAYABLE, 0 if not found>,
  "category": "one of: Fuel & Transport, Utilities, Office Stationery, Raw Material, Maintenance & Repairs, Salary & Wages, Marketing, Food & Hospitality, Logistics & Freight, Professional Services, Taxes & Compliance, IT & Software, Equipment Purchase, Printing & Packaging, Bank Charges, Miscellaneous",
  "description": "2-3 sentence description of items purchased, vendor type, and purpose. Min 30 chars, max 250 chars"
}
Rules:
- date: prefer printed date on bill, output as YYYY-MM-DD
- vendor: the shop/company name, NOT the customer name
- amount: the largest/final total including GST as a plain number (no symbols)
- category: pick the closest match from the given list
- description: write 2-3 sentences describing what was purchased, what type of shop/vendor it is, and the likely business purpose
PROMPT;

        // Groq uses OpenAI-compatible chat completions format with vision
        $payload = [
            'model'           => 'meta-llama/llama-4-scout-17b-16e-instruct',
            'response_format' => ['type' => 'json_object'],  // Force pure JSON output
            'messages'        => [
                [
                    'role'    => 'system',
                    'content' => 'You are a JSON-only bill parser. Always respond with a single valid JSON object and nothing else. No markdown, no explanation, no extra text.',
                ],
                [
                    'role'    => 'user',
                    'content' => [
                        ['type' => 'text',      'text'      => $prompt],
                        ['type' => 'image_url', 'image_url' => ['url' => (string)$imageData]],
                    ],
                ],
            ],
            'temperature' => 0.1,
            'max_tokens'  => 500,
        ];

        $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                "Authorization: Bearer {$apiKey}",
            ],
            CURLOPT_TIMEOUT        => 25,
        ]);
        $raw      = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $resp = json_decode((string)$raw, true);

        if ($httpCode === 429) {
            $errMsg = $resp['error']['message'] ?? 'Quota exceeded';
            Response::success(['fallback' => true, 'reason' => $errMsg], 'Groq quota exceeded — use Tesseract fallback');
        }

        if ($httpCode !== 200 || !$raw) {
            $errMsg = $resp['error']['message'] ?? "HTTP $httpCode";
            Response::error("Groq API error: $errMsg", 502);
        }

        $text = $resp['choices'][0]['message']['content'] ?? null;
        if (!$text) {
            Response::error('Empty response from Groq', 502);
        }

        // 1. Strip markdown fences if any
        $text = trim(preg_replace('/^```(?:json)?\s*|\s*```\s*$/i', '', trim($text)));

        // 2. Try direct parse
        $extracted = json_decode($text, true);

        // 3. If still failing, try extracting the first {...} block from the text
        if (!is_array($extracted)) {
            if (preg_match('/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/s', $text, $jsonMatch)) {
                $extracted = json_decode($jsonMatch[0], true);
            }
        }

        if (!is_array($extracted)) {
            Response::error('Could not parse Groq response as JSON. Raw: ' . substr($text, 0, 200), 502);
        }

        $extracted['fallback'] = false;
        Response::success($extracted, 'Bill extracted successfully');
    }
}
