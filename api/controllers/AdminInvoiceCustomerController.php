<?php
declare(strict_types=1);

/**
 * Admin Invoice Customers Controller
 * GET    /admin/invoice-customers              — list
 * POST   /admin/invoice-customers              — create
 * GET    /admin/invoice-customers/{id}         — single
 * PUT    /admin/invoice-customers/{id}         — update
 * DELETE /admin/invoice-customers/{id}         — delete
 * GET    /admin/invoice-customers/{id}/purchases — purchase history
 */
class AdminInvoiceCustomerController
{
    public function index(Request $request): void
    {
        $page  = max(1, (int)$request->query('page', 1));
        $limit = min(500, max(1, (int)$request->query('limit', 20)));
        $tid   = Database::tenantId();

        $where  = ['c.tenant_id = ?'];
        $params = [$tid];

        if ($search = $request->query('search')) {
            $like     = '%' . trim($search) . '%';
            $where[]  = '(c.name LIKE ? OR c.gstin LIKE ? OR c.city LIKE ? OR c.email LIKE ?)';
            $params[] = $like; $params[] = $like; $params[] = $like; $params[] = $like;
        }
        if ($type = $request->query('customer_type')) {
            if (in_array($type, ['b2b','b2c'], true)) {
                $where[] = 'c.customer_type = ?'; $params[] = $type;
            }
        }

        $wc     = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM invoice_customers c WHERE $wc", $params);
        $offset = ($page - 1) * $limit;
        $rows   = Database::fetchAll(
            "SELECT c.*,
                    COALESCE(SUM(so.total_amount), 0) AS lifetime_revenue
             FROM invoice_customers c
             LEFT JOIN marketplace_sales_orders so
                ON so.customer_id = c.customer_id AND so.tenant_id = c.tenant_id AND so.status != 'returned'
             WHERE $wc
             GROUP BY c.customer_id
             ORDER BY c.name ASC LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );
        foreach ($rows as &$r) { $r['lifetime_revenue'] = (float)$r['lifetime_revenue']; }
        Response::paginated($rows, [
            'page'        => $page, 'limit'       => $limit,
            'total'       => $total, 'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }

    public function store(Request $request): void
    {
        $name = trim((string)($request->input('name') ?? ''));
        if ($name === '') Response::error('name is required', 422);
        $id = Database::insert(
            'INSERT INTO invoice_customers
                (tenant_id, name, email, phone, gstin, address_line1, city, state, pincode, customer_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [
                Database::tenantId(),
                Request::sanitize($name),
                $request->input('email') ? strtolower(trim((string)$request->input('email'))) : null,
                $request->input('phone') ? trim((string)$request->input('phone')) : null,
                $request->input('gstin') ? strtoupper(trim((string)$request->input('gstin'))) : null,
                $request->input('address_line1') ? Request::sanitize((string)$request->input('address_line1')) : null,
                $request->input('city') ? Request::sanitize((string)$request->input('city')) : null,
                $request->input('state') ? Request::sanitize((string)$request->input('state')) : null,
                $request->input('pincode') ? trim((string)$request->input('pincode')) : null,
                in_array($request->input('customer_type'), ['b2b','b2c'], true) ? $request->input('customer_type') : 'b2c',
            ]
        );
        Response::success($this->findOrFail($id), 'Customer created', 201);
    }

    public function show(Request $request): void
    {
        Response::success($this->findOrFail((int)$request->param('id')));
    }

    public function update(Request $request): void
    {
        $id = (int)$request->param('id');
        $this->findOrFail($id);
        $allowed = ['name','email','phone','gstin','address_line1','city','state','pincode','customer_type'];
        $sets = []; $params = [];
        foreach ($allowed as $col) {
            $val = $request->input($col);
            if ($val === null) continue;
            if (in_array($col, ['name','address_line1','city','state'], true)) $val = Request::sanitize(trim((string)$val));
            elseif ($col === 'email') $val = strtolower(trim((string)$val));
            elseif ($col === 'gstin') $val = strtoupper(trim((string)$val));
            elseif ($col === 'customer_type' && !in_array($val, ['b2b','b2c'], true)) continue;
            $sets[] = "$col = ?"; $params[] = $val;
        }
        if (empty($sets)) Response::error('No fields to update', 400);
        $sets[] = 'updated_at = NOW()'; $params[] = $id; $params[] = Database::tenantId();
        Database::execute('UPDATE invoice_customers SET ' . implode(', ', $sets) . ' WHERE customer_id = ? AND tenant_id = ?', $params);
        Response::success($this->findOrFail($id), 'Customer updated');
    }

    public function destroy(Request $request): void
    {
        $id = (int)$request->param('id');
        $this->findOrFail($id);
        Database::execute('DELETE FROM invoice_customers WHERE customer_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        Response::success(null, 'Customer deleted');
    }

    public function purchases(Request $request): void
    {
        $id  = (int)$request->param('id');
        $customer = $this->findOrFail($id);
        $tid = Database::tenantId();
        $orders = Database::fetchAll(
            "SELECT so.order_id, so.order_number, so.order_date, so.marketplace,
                    so.total_amount, so.net_revenue, so.status,
                    si.invoice_number
             FROM marketplace_sales_orders so
             LEFT JOIN scan_invoices si ON si.invoice_id = so.invoice_id AND si.tenant_id = so.tenant_id
             WHERE so.customer_id = ? AND so.tenant_id = ?
             ORDER BY so.order_date DESC",
            [$id, $tid]
        );
        foreach ($orders as &$o) {
            $o['total_amount'] = (float)$o['total_amount'];
            $o['net_revenue']  = (float)$o['net_revenue'];
        }
        $customer['purchases'] = $orders;
        Response::success($customer);
    }

    private function findOrFail(int $id): array
    {
        if ($id <= 0) Response::error('Invalid ID', 400);
        $row = Database::fetch('SELECT * FROM invoice_customers WHERE customer_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
        if (!$row) Response::error('Customer not found', 404);
        $row['lifetime_revenue'] = (float)$row['lifetime_revenue'];
        return $row;
    }
}
