<?php
declare(strict_types=1);

/**
 * Admin Machine Controller
 * GET    /admin/machines               — list machines (filter: customer_id, status)
 * GET    /admin/machines/{id}          — single machine
 * POST   /admin/machines              — create machine
 * PUT    /admin/machines/{id}          — update machine
 * DELETE /admin/machines/{id}          — deactivate machine
 */
class AdminMachineController
{
    public function index(Request $request): void
    {
        $tenantId   = Database::tenantId();
        $customerId = $request->query('customer_id');
        $status     = $request->query('status');
        $search     = $request->query('search');

        $sql    = 'SELECT m.*, c.name AS customer_name FROM machines m LEFT JOIN customers c ON c.id = m.customer_id WHERE m.tenant_id = ?';
        $params = [$tenantId];

        if ($customerId) {
            $sql    .= ' AND m.customer_id = ?';
            $params[] = (int)$customerId;
        }
        if ($status) {
            $sql    .= ' AND m.status = ?';
            $params[] = $status;
        }
        if ($search) {
            $sql    .= ' AND (m.machine_id LIKE ? OR m.model LIKE ? OR c.name LIKE ?)';
            $like    = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $sql .= ' ORDER BY m.machine_id ASC';
        $rows = Database::fetchAll($sql, $params);
        Response::success(array_map([$this, 'format'], $rows));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $row = Database::fetch(
            'SELECT m.*, c.name AS customer_name FROM machines m LEFT JOIN customers c ON c.id = m.customer_id WHERE m.id = ? AND m.tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$row) Response::error('Machine not found', 404);
        Response::success($this->format($row));
    }

    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $machineId  = trim((string)($body['machine_id']  ?? ''));
        $model      = trim((string)($body['model']       ?? ''));
        $customerId = (int)($body['customer_id']         ?? 0);
        $locName    = trim((string)($body['location_name'] ?? ''));

        if (!$machineId)  Response::error('Machine ID is required', 422);
        if (!$model)      Response::error('Model is required', 422);
        if (!$customerId) Response::error('Customer is required', 422);
        if (!$locName)    Response::error('Location name is required', 422);

        $customer = Database::fetch(
            'SELECT id FROM customers WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$customerId, $tenantId]
        );
        if (!$customer) Response::error('Customer not found', 404);

        $dup = Database::fetch(
            'SELECT id FROM machines WHERE machine_id = ? AND tenant_id = ? LIMIT 1',
            [$machineId, $tenantId]
        );
        if ($dup) Response::error('Machine ID already exists', 409);

        $id = Database::insert('machines', [
            'tenant_id'         => $tenantId,
            'machine_id'        => $machineId,
            'model'             => $model,
            'category'          => trim((string)($body['category']          ?? '')),
            'customer_id'       => $customerId,
            'location_name'     => $locName,
            'address'           => trim((string)($body['address']           ?? '')),
            'latitude'          => isset($body['latitude'])  ? (float)$body['latitude']  : null,
            'longitude'         => isset($body['longitude']) ? (float)$body['longitude'] : null,
            'geofence_radius_m' => isset($body['geofence_radius_m']) ? (int)$body['geofence_radius_m'] : 100,
            'installed_date'    => $body['installed_date']   ?? null,
            'warranty_expiry'   => $body['warranty_expiry']  ?? null,
            'status'            => in_array($body['status'] ?? '', ['active','inactive','under_repair']) ? $body['status'] : 'active',
            'notes'             => trim((string)($body['notes'] ?? '')),
        ]);

        $row = Database::fetch(
            'SELECT m.*, c.name AS customer_name FROM machines m LEFT JOIN customers c ON c.id = m.customer_id WHERE m.id = ? LIMIT 1',
            [$id]
        );
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $machine = Database::fetch(
            'SELECT id FROM machines WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$machine) Response::error('Machine not found', 404);

        $updates = [];
        $fields  = ['model','category','location_name','address','installed_date','warranty_expiry','notes'];
        foreach ($fields as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        if (isset($body['latitude']))          $updates['latitude']          = (float)$body['latitude'];
        if (isset($body['longitude']))         $updates['longitude']         = (float)$body['longitude'];
        if (isset($body['geofence_radius_m'])) $updates['geofence_radius_m'] = (int)$body['geofence_radius_m'];
        if (isset($body['status']) && in_array($body['status'], ['active','inactive','under_repair'])) {
            $updates['status'] = $body['status'];
        }
        if (isset($body['customer_id'])) {
            $cust = Database::fetch('SELECT id FROM customers WHERE id = ? AND tenant_id = ? LIMIT 1', [(int)$body['customer_id'], $tenantId]);
            if (!$cust) Response::error('Customer not found', 404);
            $updates['customer_id'] = (int)$body['customer_id'];
        }

        if (!empty($updates)) {
            Database::update('machines', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch(
            'SELECT m.*, c.name AS customer_name FROM machines m LEFT JOIN customers c ON c.id = m.customer_id WHERE m.id = ? LIMIT 1',
            [$id]
        );
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $machine = Database::fetch(
            'SELECT id FROM machines WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$machine) Response::error('Machine not found', 404);

        $openTickets = Database::fetch(
            "SELECT id FROM tickets WHERE machine_id = ? AND tenant_id = ? AND status NOT IN ('closed','resolved') LIMIT 1",
            [$id, $tenantId]
        );
        if ($openTickets) Response::error('Cannot deactivate machine with open tickets', 409);

        Database::update('machines', ['status' => 'inactive'], ['id' => $id, 'tenant_id' => $tenantId]);
        Response::success(['message' => 'Machine deactivated']);
    }

    private function format(array $row): array
    {
        return [
            'id'                => (int)$row['id'],
            'machine_id'        => $row['machine_id'],
            'model'             => $row['model'],
            'category'          => $row['category'],
            'customer_id'       => (int)$row['customer_id'],
            'customer_name'     => $row['customer_name'] ?? null,
            'location_name'     => $row['location_name'],
            'address'           => $row['address'],
            'latitude'          => $row['latitude'] !== null ? (float)$row['latitude'] : null,
            'longitude'         => $row['longitude'] !== null ? (float)$row['longitude'] : null,
            'geofence_radius_m' => (int)$row['geofence_radius_m'],
            'installed_date'    => $row['installed_date'],
            'warranty_expiry'   => $row['warranty_expiry'],
            'status'            => $row['status'],
            'notes'             => $row['notes'],
            'created_at'        => $row['created_at'],
        ];
    }
}
