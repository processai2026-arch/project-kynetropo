<?php
declare(strict_types=1);

/**
 * Admin Order Controller
 * GET    /admin/orders               — list orders
 * GET    /admin/orders/{id}          — single order with items
 * POST   /admin/orders              — create order with items
 * PUT    /admin/orders/{id}          — update order status / details
 * DELETE /admin/orders/{id}          — cancel order
 */
class AdminOrderController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $sql    = 'SELECT o.*, c.name AS customer_name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.tenant_id = ?';
        $params = [$tenantId];

        if ($s = $request->query('status')) {
            $sql .= ' AND o.status = ?'; $params[] = $s;
        }
        if ($c = $request->query('customer_id')) {
            $sql .= ' AND o.customer_id = ?'; $params[] = (int)$c;
        }
        if ($q = $request->query('search')) {
            $sql .= ' AND (o.order_number LIKE ? OR c.name LIKE ?)';
            $like = '%'.$q.'%'; $params[] = $like; $params[] = $like;
        }

        $sql .= ' ORDER BY o.created_at DESC';
        $rows = Database::fetchAll($sql, $params);
        Response::success(array_map([$this, 'format'], $rows));
    }

    public function show(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $row = Database::fetch(
            'SELECT o.*, c.name AS customer_name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ? AND o.tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$row) Response::error('Order not found', 404);

        $items = Database::fetchAll(
            'SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC',
            [$id]
        );

        $data          = $this->format($row);
        $data['items'] = $items;
        Response::success($data);
    }

    public function store(Request $request): void
    {
        $body       = $request->body();
        $tenantId   = Database::tenantId();
        $customerId = (int)($body['customer_id'] ?? 0);
        $items      = $body['items'] ?? [];

        if (!$customerId)       Response::error('Customer is required', 422);
        if (empty($items))      Response::error('At least one item is required', 422);

        $customer = Database::fetch(
            'SELECT id, address FROM customers WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$customerId, $tenantId]
        );
        if (!$customer) Response::error('Customer not found', 404);

        $orderNumber = $this->nextOrderNumber($tenantId);

        $orderId = Database::insert('orders', [
            'tenant_id'        => $tenantId,
            'order_number'     => $orderNumber,
            'customer_id'      => $customerId,
            'status'           => 'pending',
            'total_amount'     => 0,
            'notes'            => trim((string)($body['notes']            ?? '')),
            'delivery_address' => trim((string)($body['delivery_address'] ?? $customer['address'] ?? '')),
            'order_date'       => date('Y-m-d'),
            'expected_delivery'=> $body['expected_delivery'] ?? null,
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

        $row = Database::fetch(
            'SELECT o.*, c.name AS customer_name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ? LIMIT 1',
            [$orderId]
        );
        $data          = $this->format($row);
        $data['items'] = Database::fetchAll('SELECT * FROM order_items WHERE order_id = ?', [$orderId]);
        Response::success($data, 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $order = Database::fetch(
            'SELECT id FROM orders WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$order) Response::error('Order not found', 404);

        $updates = [];
        $validStatuses = ['pending','confirmed','processing','dispatched','delivered','cancelled'];
        if (isset($body['status']) && in_array($body['status'], $validStatuses)) {
            $updates['status'] = $body['status'];
        }
        if (isset($body['notes']))             $updates['notes']             = trim((string)$body['notes']);
        if (isset($body['delivery_address']))  $updates['delivery_address']  = trim((string)$body['delivery_address']);
        if (isset($body['expected_delivery'])) $updates['expected_delivery'] = $body['expected_delivery'];

        if (!empty($updates)) {
            Database::update('orders', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch(
            'SELECT o.*, c.name AS customer_name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = ? LIMIT 1',
            [$id]
        );
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();

        $order = Database::fetch(
            "SELECT id, status FROM orders WHERE id = ? AND tenant_id = ? LIMIT 1",
            [$id, $tenantId]
        );
        if (!$order) Response::error('Order not found', 404);
        if (in_array($order['status'], ['delivered'])) Response::error('Cannot cancel a delivered order', 409);

        Database::update('orders', ['status' => 'cancelled'], ['id' => $id, 'tenant_id' => $tenantId]);
        Response::success(['message' => 'Order cancelled']);
    }

    private function nextOrderNumber(int $tenantId): string
    {
        $last = Database::fetch(
            "SELECT order_number FROM orders WHERE tenant_id = ? ORDER BY id DESC LIMIT 1",
            [$tenantId]
        );
        if ($last) {
            preg_match('/(\d+)$/', $last['order_number'], $m);
            $num = isset($m[1]) ? (int)$m[1] + 1 : 1;
        } else {
            $num = 1;
        }
        return 'ORD-' . str_pad((string)$num, 4, '0', STR_PAD_LEFT);
    }

    private function format(array $row): array
    {
        return [
            'id'               => (int)$row['id'],
            'order_number'     => $row['order_number'],
            'customer_id'      => (int)$row['customer_id'],
            'customer_name'    => $row['customer_name'] ?? null,
            'status'           => $row['status'],
            'total_amount'     => (float)$row['total_amount'],
            'notes'            => $row['notes'],
            'delivery_address' => $row['delivery_address'],
            'order_date'       => $row['order_date'],
            'expected_delivery'=> $row['expected_delivery'],
            'created_at'       => $row['created_at'],
        ];
    }
}
