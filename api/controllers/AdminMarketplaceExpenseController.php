<?php
declare(strict_types=1);

/**
 * Admin Marketplace Expense Controller
 * GET    /admin/marketplace-expenses/summary  — totals by category
 * GET    /admin/marketplace-expenses           — list + filters
 * POST   /admin/marketplace-expenses           — create
 * PUT    /admin/marketplace-expenses/{id}      — update
 * DELETE /admin/marketplace-expenses/{id}      — delete
 */
class AdminMarketplaceExpenseController
{
    public function summary(Request $request): void
    {
        $tid  = Database::tenantId();
        $from = $request->query('from') ?: date('Y-m-01');
        $to   = $request->query('to')   ?: date('Y-m-d');

        $rows = Database::fetchAll(
            'SELECT category, SUM(amount) AS total
             FROM marketplace_expenses
             WHERE tenant_id = ? AND expense_date BETWEEN ? AND ?
             GROUP BY category
             ORDER BY total DESC',
            [$tid, $from, $to]
        );
        $total = 0.0;
        $byCategory = [];
        foreach ($rows as $r) {
            $amt = (float)$r['total'];
            $byCategory[$r['category']] = $amt;
            $total += $amt;
        }
        Response::success(['total' => $total, 'by_category' => $byCategory, 'from' => $from, 'to' => $to]);
    }

    public function index(Request $request): void
    {
        $page   = max(1, (int)$request->query('page', 1));
        $limit  = min(500, max(1, (int)$request->query('limit', 20)));
        $tid    = Database::tenantId();
        $where  = ['tenant_id = ?'];
        $params = [$tid];

        if ($from = $request->query('from_date')) { $where[] = 'expense_date >= ?'; $params[] = $from; }
        if ($to   = $request->query('to_date'))   { $where[] = 'expense_date <= ?'; $params[] = $to; }
        if ($cat  = $request->query('category'))  { $where[] = 'category = ?'; $params[] = $cat; }
        if ($mp   = $request->query('marketplace')) {
            $valid = ['amazon','flipkart','meesho','other','none'];
            if (in_array($mp, $valid, true)) { $where[] = 'marketplace = ?'; $params[] = $mp; }
        }

        $wc     = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM marketplace_expenses WHERE $wc", $params);
        $offset = ($page - 1) * $limit;
        $rows   = Database::fetchAll(
            "SELECT * FROM marketplace_expenses WHERE $wc ORDER BY expense_date DESC LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );
        foreach ($rows as &$r) { $r['amount'] = (float)$r['amount']; }
        Response::paginated($rows, [
            'page' => $page, 'limit' => $limit, 'total' => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }

    public function store(Request $request): void
    {
        $category = trim((string)($request->input('category') ?? ''));
        $desc     = trim((string)($request->input('description') ?? ''));
        $amount   = $request->input('amount');
        $date     = trim((string)($request->input('expense_date') ?? ''));
        if ($category === '' || $desc === '' || !is_numeric($amount) || $date === '') {
            Response::error('category, description, amount, and expense_date are required', 422);
        }
        if ((float)$amount <= 0) Response::error('amount must be positive', 422);
        $mp = $request->input('marketplace') ?? 'none';
        $validMp = ['amazon','flipkart','meesho','other','none'];
        if (!in_array($mp, $validMp, true)) $mp = 'none';

        $id = Database::insert(
            'INSERT INTO marketplace_expenses
                (tenant_id, invoice_id, category, description, amount, expense_date, marketplace, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [
                Database::tenantId(),
                $request->input('invoice_id') ? (int)$request->input('invoice_id') : null,
                Request::sanitize($category),
                Request::sanitize($desc),
                (float)$amount,
                $date,
                $mp,
            ]
        );
        $row = Database::fetch('SELECT * FROM marketplace_expenses WHERE expense_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        $row['amount'] = (float)$row['amount'];
        Response::success($row, 'Expense created', 201);
    }

    public function update(Request $request): void
    {
        $id  = (int)$request->param('id');
        if ($id <= 0 || !Database::fetch('SELECT expense_id FROM marketplace_expenses WHERE expense_id = ? AND tenant_id = ?', [$id, Database::tenantId()])) {
            Response::error('Expense not found', 404);
        }
        $allowed = ['category','description','amount','expense_date','marketplace'];
        $sets = []; $params = [];
        foreach ($allowed as $col) {
            $val = $request->input($col);
            if ($val === null) continue;
            if (in_array($col, ['category','description'], true)) $val = Request::sanitize(trim((string)$val));
            elseif ($col === 'amount') $val = (float)$val;
            $sets[] = "$col = ?"; $params[] = $val;
        }
        if (empty($sets)) Response::error('No fields to update', 400);
        $sets[] = 'updated_at = NOW()'; $params[] = $id; $params[] = Database::tenantId();
        Database::execute('UPDATE marketplace_expenses SET ' . implode(', ', $sets) . ' WHERE expense_id = ? AND tenant_id = ?', $params);
        $row = Database::fetch('SELECT * FROM marketplace_expenses WHERE expense_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        $row['amount'] = (float)$row['amount'];
        Response::success($row, 'Expense updated');
    }

    public function destroy(Request $request): void
    {
        $id = (int)$request->param('id');
        if ($id <= 0 || !Database::fetch('SELECT expense_id FROM marketplace_expenses WHERE expense_id = ? AND tenant_id = ?', [$id, Database::tenantId()])) {
            Response::error('Expense not found', 404);
        }
        Database::execute('DELETE FROM marketplace_expenses WHERE expense_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        Response::success(null, 'Expense deleted');
    }
}
