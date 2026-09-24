<?php
declare(strict_types=1);

/**
 * Admin Customer Controller
 * GET    /admin/customers               — list all customers
 * GET    /admin/customers/{id}          — single customer with machines + tickets
 * POST   /admin/customers              — create customer
 * PUT    /admin/customers/{id}          — update customer
 * DELETE /admin/customers/{id}          — deactivate customer
 */
class AdminCustomerController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $status   = $request->query('status');
        $search   = $request->query('search');

        $sql    = 'SELECT * FROM customers WHERE tenant_id = ?';
        $params = [$tenantId];

        if ($status) {
            $sql    .= ' AND status = ?';
            $params[] = $status;
        }
        if ($search) {
            $sql    .= ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $like    = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $sql .= ' ORDER BY name ASC';
        $rows = Database::fetchAll($sql, $params);
        Response::success(array_map([$this, 'format'], $rows));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $customer = Database::fetch(
            'SELECT * FROM customers WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$customer) Response::error('Customer not found', 404);

        $machines = Database::fetchAll(
            'SELECT id, machine_id, model, category, location_name, status FROM machines WHERE customer_id = ? AND tenant_id = ? ORDER BY machine_id ASC',
            [$id, $tenantId]
        );

        $tickets = Database::fetchAll(
            'SELECT id, ticket_number, title, priority, status, created_at FROM tickets WHERE customer_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 10',
            [$id, $tenantId]
        );

        $data             = $this->format($customer);
        $data['machines'] = $machines;
        $data['tickets']  = $tickets;
        Response::success($data);
    }

    public function store(Request $request): void
    {
        $body = $request->body();

        $name   = trim((string)($body['name']   ?? ''));
        $email  = strtolower(trim((string)($body['email'] ?? '')));
        $phone  = trim((string)($body['phone']  ?? ''));

        if (!$name)  Response::error('Name is required', 422);
        if (!$phone) Response::error('Phone is required', 422);
        if (!$email) Response::error('Email is required', 422);

        $tenantId = Database::tenantId();

        $exists = Database::fetch(
            'SELECT id FROM customers WHERE email = ? AND tenant_id = ? LIMIT 1',
            [$email, $tenantId]
        );
        if ($exists) Response::error('Email already registered for another customer', 409);

        $id = Database::insert('customers', [
            'tenant_id'      => $tenantId,
            'name'           => $name,
            'contact_person' => trim((string)($body['contact_person'] ?? '')),
            'email'          => $email,
            'phone'          => $phone,
            'address'        => trim((string)($body['address'] ?? '')),
            'city'           => trim((string)($body['city']    ?? '')),
            'state'          => trim((string)($body['state']   ?? '')),
            'status'         => in_array($body['status'] ?? '', ['active','inactive']) ? $body['status'] : 'active',
            'notes'          => trim((string)($body['notes']   ?? '')),
        ]);

        $row = Database::fetch('SELECT * FROM customers WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $customer = Database::fetch(
            'SELECT * FROM customers WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$customer) Response::error('Customer not found', 404);

        $updates = [];
        if (isset($body['name']))           $updates['name']           = trim((string)$body['name']);
        if (isset($body['contact_person'])) $updates['contact_person'] = trim((string)$body['contact_person']);
        if (isset($body['phone']))          $updates['phone']          = trim((string)$body['phone']);
        if (isset($body['address']))        $updates['address']        = trim((string)$body['address']);
        if (isset($body['city']))           $updates['city']           = trim((string)$body['city']);
        if (isset($body['state']))          $updates['state']          = trim((string)$body['state']);
        if (isset($body['notes']))          $updates['notes']          = trim((string)$body['notes']);
        if (isset($body['status']) && in_array($body['status'], ['active','inactive'])) {
            $updates['status'] = $body['status'];
        }

        if (!empty($updates)) {
            Database::update('customers', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch('SELECT * FROM customers WHERE id = ? LIMIT 1', [$id]);
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $customer = Database::fetch(
            'SELECT id FROM customers WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$customer) Response::error('Customer not found', 404);

        $openTickets = Database::fetch(
            "SELECT id FROM tickets WHERE customer_id = ? AND tenant_id = ? AND status NOT IN ('closed','resolved') LIMIT 1",
            [$id, $tenantId]
        );
        if ($openTickets) Response::error('Cannot deactivate customer with open tickets', 409);

        Database::update('customers', ['status' => 'inactive'], ['id' => $id, 'tenant_id' => $tenantId]);
        Response::success(['message' => 'Customer deactivated']);
    }

    private function format(array $row): array
    {
        return [
            'id'             => (int)$row['id'],
            'name'           => $row['name'],
            'contact_person' => $row['contact_person'],
            'email'          => $row['email'],
            'phone'          => $row['phone'],
            'address'        => $row['address'],
            'city'           => $row['city'],
            'state'          => $row['state'],
            'status'         => $row['status'],
            'notes'          => $row['notes'],
            'user_id'        => $row['user_id'] ? (int)$row['user_id'] : null,
            'created_at'     => $row['created_at'],
        ];
    }
}
