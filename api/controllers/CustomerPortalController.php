<?php
declare(strict_types=1);

/**
 * Customer Portal Controller
 * All routes require 'customer' middleware (role=customer in JWT)
 *
 * GET  /customer/dashboard-stats  — summary for customer
 * GET  /customer/machines         — customer's own machines
 * GET  /customer/tickets          — customer's own tickets
 * POST /customer/tickets          — raise a ticket
 * GET  /customer/tickets/{id}     — ticket detail with notes
 * POST /customer/tickets/{id}/notes — add note on ticket
 * GET  /customer/products         — active product catalog
 * GET  /customer/orders           — customer's own orders
 * POST /customer/orders           — place order
 * GET  /customer/orders/{id}      — order detail with items
 */
class CustomerPortalController
{
    private function customerId(Request $request): int
    {
        // JWT carries user_id; look up the linked customer record
        $userId   = $request->user['user_id'] ?? 0;
        $tenantId = Database::tenantId();
        $customer = Database::fetch(
            'SELECT id FROM customers WHERE user_id = ? AND tenant_id = ? LIMIT 1',
            [$userId, $tenantId]
        );
        if (!$customer) Response::error('Customer account not found', 403);
        return (int)$customer['id'];
    }

    public function dashboardStats(Request $request): void
    {
        $customerId = $this->customerId($request);
        $tenantId   = Database::tenantId();

        $openTickets = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM tickets WHERE customer_id = ? AND tenant_id = ? AND status IN ('open','assigned','in_progress')",
            [$customerId, $tenantId]
        )['cnt'] ?? 0);

        $pendingOrders = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = ? AND tenant_id = ? AND status IN ('pending','confirmed','processing','dispatched')",
            [$customerId, $tenantId]
        )['cnt'] ?? 0);

        $totalMachines = (int)(Database::fetch(
            "SELECT COUNT(*) AS cnt FROM machines WHERE customer_id = ? AND tenant_id = ? AND status = 'active'",
            [$customerId, $tenantId]
        )['cnt'] ?? 0);

        $recentTickets = Database::fetchAll(
            "SELECT t.id, t.ticket_number, t.title, t.priority, t.status, t.created_at,
                    m.machine_id AS machine_code, m.model AS machine_model
             FROM tickets t LEFT JOIN machines m ON m.id = t.machine_id
             WHERE t.customer_id = ? AND t.tenant_id = ?
             ORDER BY t.created_at DESC LIMIT 5",
            [$customerId, $tenantId]
        );

        Response::success([
            'open_tickets'  => $openTickets,
            'pending_orders'=> $pendingOrders,
            'total_machines'=> $totalMachines,
            'recent_tickets'=> $recentTickets,
        ]);
    }

    public function machines(Request $request): void
    {
        $customerId = $this->customerId($request);
        $tenantId   = Database::tenantId();

        $rows = Database::fetchAll(
            'SELECT id, machine_id, model, category, location_name, status, installed_date, warranty_expiry FROM machines WHERE customer_id = ? AND tenant_id = ? ORDER BY machine_id ASC',
            [$customerId, $tenantId]
        );
        Response::success($rows);
    }

    public function tickets(Request $request): void
    {
        $customerId = $this->customerId($request);
        $tenantId   = Database::tenantId();

        $sql    = "SELECT t.*, m.machine_id AS machine_code, m.model AS machine_model, e.name AS employee_name
                   FROM tickets t
                   LEFT JOIN machines m  ON m.id = t.machine_id
                   LEFT JOIN employees e ON e.id = t.assigned_employee_id
                   WHERE t.customer_id = ? AND t.tenant_id = ?";
        $params = [$customerId, $tenantId];

        if ($s = $request->query('status')) { $sql .= ' AND t.status = ?'; $params[] = $s; }

        $sql .= ' ORDER BY t.created_at DESC';
        $rows  = Database::fetchAll($sql, $params);
        Response::success($rows);
    }

    public function showTicket(Request $request): void
    {
        $id         = (int) $request->param('id');
        $customerId = $this->customerId($request);
        $tenantId   = Database::tenantId();

        $row = Database::fetch(
            "SELECT t.*, m.machine_id AS machine_code, m.model AS machine_model, e.name AS employee_name
             FROM tickets t
             LEFT JOIN machines m  ON m.id = t.machine_id
             LEFT JOIN employees e ON e.id = t.assigned_employee_id
             WHERE t.id = ? AND t.customer_id = ? AND t.tenant_id = ? LIMIT 1",
            [$id, $customerId, $tenantId]
        );
        if (!$row) Response::error('Ticket not found', 404);

        $notes = Database::fetchAll('SELECT * FROM ticket_notes WHERE ticket_id = ? ORDER BY created_at ASC', [$id]);
        $row['notes'] = $notes;
        Response::success($row);
    }

    public function storeTicket(Request $request): void
    {
        $body       = $request->body();
        $customerId = $this->customerId($request);
        $tenantId   = Database::tenantId();

        $machineId = (int)($body['machine_id'] ?? 0);
        $title     = trim((string)($body['title'] ?? ''));
        if (!$machineId) Response::error('Machine is required', 422);
        if (!$title)     Response::error('Title is required', 422);

        $machine = Database::fetch(
            'SELECT id, customer_id FROM machines WHERE id = ? AND customer_id = ? AND tenant_id = ? LIMIT 1',
            [$machineId, $customerId, $tenantId]
        );
        if (!$machine) Response::error('Machine not found', 404);

        $ticketNumber = $this->nextTicketNumber($tenantId);
        $id = Database::insert('tickets', [
            'tenant_id'     => $tenantId,
            'ticket_number' => $ticketNumber,
            'machine_id'    => $machineId,
            'customer_id'   => $customerId,
            'title'         => $title,
            'description'   => trim((string)($body['description'] ?? '')),
            'priority'      => in_array($body['priority'] ?? '', ['low','medium','high','urgent']) ? $body['priority'] : 'medium',
            'status'        => 'open',
            'raised_by'     => 'customer',
        ]);

        $row = Database::fetch('SELECT * FROM tickets WHERE id = ? LIMIT 1', [$id]);
        Response::success($row, 'Created', 201);
    }

    public function addTicketNote(Request $request): void
    {
        $id         = (int) $request->param('id');
        $customerId = $this->customerId($request);
        $tenantId   = Database::tenantId();
        $body       = $request->body();

        $ticket = Database::fetch(
            'SELECT id FROM tickets WHERE id = ? AND customer_id = ? AND tenant_id = ? LIMIT 1',
            [$id, $customerId, $tenantId]
        );
        if (!$ticket) Response::error('Ticket not found', 404);

        $note = trim((string)($body['note'] ?? ''));
        if (!$note) Response::error('Note is required', 422);

        $userId   = $request->user['user_id'] ?? 0;
        $customer = Database::fetch('SELECT name FROM customers WHERE user_id = ? AND tenant_id = ? LIMIT 1', [$userId, $tenantId]);
        $authorName = $customer['name'] ?? 'Customer';

        $noteId = Database::insert('ticket_notes', [
            'tenant_id'   => $tenantId,
            'ticket_id'   => $id,
            'author_name' => $authorName,
            'author_role' => 'customer',
            'note'        => $note,
        ]);

        $row = Database::fetch('SELECT * FROM ticket_notes WHERE id = ? LIMIT 1', [$noteId]);
        Response::success($row, 'Created', 201);
    }

    public function products(Request $request): void
    {
        $tenantId = Database::tenantId();
        $rows     = Database::fetchAll(
            'SELECT id, name, sku, category, description, unit, unit_price FROM products WHERE tenant_id = ? AND is_active = 1 ORDER BY name ASC',
            [$tenantId]
        );
        Response::success($rows);
    }

    public function orders(Request $request): void
    {
        $customerId = $this->customerId($request);
        $tenantId   = Database::tenantId();

        $sql    = 'SELECT * FROM orders WHERE customer_id = ? AND tenant_id = ?';
        $params = [$customerId, $tenantId];
        if ($s = $request->query('status')) { $sql .= ' AND status = ?'; $params[] = $s; }
        $sql .= ' ORDER BY created_at DESC';
        $rows = Database::fetchAll($sql, $params);
        Response::success($rows);
    }

    public function showOrder(Request $request): void
    {
        $id         = (int) $request->param('id');
        $customerId = $this->customerId($request);
        $tenantId   = Database::tenantId();

        $row = Database::fetch(
            'SELECT * FROM orders WHERE id = ? AND customer_id = ? AND tenant_id = ? LIMIT 1',
            [$id, $customerId, $tenantId]
        );
        if (!$row) Response::error('Order not found', 404);

        $row['items'] = Database::fetchAll('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [$id]);
        Response::success($row);
    }

    public function storeOrder(Request $request): void
    {
        $body       = $request->body();
        $customerId = $this->customerId($request);
        $tenantId   = Database::tenantId();
        $items      = $body['items'] ?? [];

        if (empty($items)) Response::error('At least one item is required', 422);

        $customer = Database::fetch('SELECT address FROM customers WHERE id = ? AND tenant_id = ? LIMIT 1', [$customerId, $tenantId]);
        $orderNumber = $this->nextOrderNumber($tenantId);

        $orderId = Database::insert('orders', [
            'tenant_id'        => $tenantId,
            'order_number'     => $orderNumber,
            'customer_id'      => $customerId,
            'status'           => 'pending',
            'total_amount'     => 0,
            'notes'            => trim((string)($body['notes'] ?? '')),
            'delivery_address' => trim((string)($body['delivery_address'] ?? $customer['address'] ?? '')),
            'order_date'       => date('Y-m-d'),
            'expected_delivery'=> null,
        ]);

        $total = 0.0;
        foreach ($items as $item) {
            $productId = (int)($item['product_id'] ?? 0);
            $qty       = max(1, (int)($item['quantity'] ?? 1));
            if (!$productId) continue;

            $product = Database::fetch(
                'SELECT id, name, unit_price FROM products WHERE id = ? AND tenant_id = ? AND is_active = 1 LIMIT 1',
                [$productId, $tenantId]
            );
            if (!$product) continue;

            $unitPrice = (float)$product['unit_price'];
            $subtotal  = $unitPrice * $qty;
            $total    += $subtotal;

            Database::insert('order_items', [
                'tenant_id'    => $tenantId,
                'order_id'     => $orderId,
                'product_id'   => $productId,
                'product_name' => $product['name'],
                'unit_price'   => $unitPrice,
                'quantity'     => $qty,
                'subtotal'     => $subtotal,
            ]);
        }

        Database::update('orders', ['total_amount' => $total], ['id' => $orderId]);

        $row          = Database::fetch('SELECT * FROM orders WHERE id = ? LIMIT 1', [$orderId]);
        $row['items'] = Database::fetchAll('SELECT * FROM order_items WHERE order_id = ?', [$orderId]);
        Response::success($row, 'Created', 201);
    }

    private function nextTicketNumber(int $tenantId): string
    {
        $last = Database::fetch("SELECT ticket_number FROM tickets WHERE tenant_id = ? ORDER BY id DESC LIMIT 1", [$tenantId]);
        $num  = 1;
        if ($last) { preg_match('/(\d+)$/', $last['ticket_number'], $m); $num = isset($m[1]) ? (int)$m[1] + 1 : 1; }
        return 'TKT-' . str_pad((string)$num, 4, '0', STR_PAD_LEFT);
    }

    private function nextOrderNumber(int $tenantId): string
    {
        $last = Database::fetch("SELECT order_number FROM orders WHERE tenant_id = ? ORDER BY id DESC LIMIT 1", [$tenantId]);
        $num  = 1;
        if ($last) { preg_match('/(\d+)$/', $last['order_number'], $m); $num = isset($m[1]) ? (int)$m[1] + 1 : 1; }
        return 'ORD-' . str_pad((string)$num, 4, '0', STR_PAD_LEFT);
    }
}
