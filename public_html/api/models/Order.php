<?php
declare(strict_types=1);
// kjahkj
class Order
{
    public const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out for delivery', 'delivered', 'cancelled', 'returned'];
    public const CANCELLABLE = ['pending', 'confirmed'];

    /**
     * Legal order state machine. Keys are the current status; values are the
     * set of statuses that may be transitioned to from there. Any transition
     * not listed here (including same-status no-ops and moves out of a
     * terminal state) is illegal and must be rejected with 409.
     */
    public const TRANSITIONS = [
        'pending'           => ['confirmed', 'cancelled'],
        'confirmed'         => ['processing', 'cancelled'],
        'processing'        => ['shipped', 'cancelled'],
        'shipped'           => ['out for delivery', 'delivered', 'returned'],
        'out for delivery'  => ['delivered', 'returned'],
        'delivered'         => ['returned'],
        'cancelled'         => [],
        'returned'          => [],
    ];

    /**
     * True if $from -> $to is a legal transition under the state machine.
     */
    public static function isLegalTransition(string $from, string $to): bool
    {
        $from = strtolower($from);
        $to   = strtolower($to);
        if ($from === $to) {
            return false;
        }
        return in_array($to, self::TRANSITIONS[$from] ?? [], true);
    }

    /**
     * Create an order with multiple items inside a transaction.
     *
     * $items = [
     *   ['product_id' => 1, 'config_id' => 2, 'quantity' => 100, 'unit_price' => 9.00, 'size' => '8mm', 'purpose' => 'Boiler']
     * ]
     *
     * @throws AppException
     */
    public static function create(int $userId, array $items, array $meta = []): int
    {
        $db = Database::getInstance();
        try {
            $db->beginTransaction();

            // Generate order number: ES + YYYYMMDD + 4-digit sequence
            $tid         = Database::tenantId();
            $prefix      = Database::fetch("SELECT setting_value FROM settings WHERE setting_key = 'order_prefix' AND tenant_id = ?", [$tid])['setting_value'] ?? 'ES';
            $count       = Database::count('SELECT COUNT(*) AS cnt FROM orders WHERE tenant_id = ?', [$tid]);
            $orderNumber = $prefix . date('Ymd') . str_pad((string)($count + 1), 4, '0', STR_PAD_LEFT);

            // Delivery fee from settings
            // Changed to 0 as per requirements so orders do not have unexpected charges.
            $deliveryFee = 0;

            // Calculate total from items
            $itemsTotal = array_reduce($items, fn($carry, $item) => $carry + ((float)$item['unit_price'] * (int)$item['quantity']), 0.0);
            $totalAmount = $itemsTotal + $deliveryFee;

            $orderId = Database::insertTenant('orders', [
                'user_id'          => $userId,
                'order_number'     => $orderNumber,
                'total_amount'     => $totalAmount,
                'delivery_fee'     => $deliveryFee,
                'order_status'     => 'pending',
                'payment_status'   => 'pending',
                'payment_method'   => $meta['payment_method']   ?? null,
                'delivery_address' => $meta['delivery_address'] ?? null,
                'delivery_city'    => $meta['delivery_city']    ?? null,
                'delivery_state'   => $meta['delivery_state']   ?? null,
                'delivery_pincode' => $meta['delivery_pincode'] ?? null,
                'notes'            => $meta['notes']            ?? null,
                'created_at'       => date('Y-m-d H:i:s'),
            ]);

            foreach ($items as $item) {
                Database::insertTenant('order_items', [
                    'order_id'    => $orderId,
                    'product_id'  => (int)$item['product_id'],
                    'config_id'   => isset($item['config_id']) ? (int)$item['config_id'] : null,
                    'quantity'    => (int)$item['quantity'],
                    'unit_price'  => (float)$item['unit_price'],
                    'total_price' => (float)$item['unit_price'] * (int)$item['quantity'],
                    'size'        => $item['size']    ?? null,
                    'purpose'     => $item['purpose'] ?? null,
                    'sub_purpose' => $item['sub_purpose'] ?? null,
                    'created_at'  => date('Y-m-d H:i:s'),
                ]);
            }

            // Audit log
            Database::insertTenant('audit_log', [
                'user_id'    => $userId,
                'action'     => 'ORDER_CREATED',
                'table_name' => 'orders',
                'record_id'  => $orderId,
                'new_value'  => $orderNumber,
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            $db->commit();
            return $orderId;

        } catch (AppException $e) {
            $db->rollBack();
            throw $e;
        } catch (Throwable $e) {
            $db->rollBack();
            error_log('[Order::create] ' . $e->getMessage());
            throw new AppException('Failed to create order', 500);
        }
    }

    /**
     * Get a single order with its items and customer info.
     *
     * @param bool $withExtras When true (default), also attaches the status
     *                         timeline and a read-only stock-availability check.
     *                         Internal callers that only need core order fields
     *                         (e.g. inventory hooks, notifications) can pass
     *                         false to skip the extra queries.
     */
    public static function findById(int $orderId, bool $withExtras = true): ?array
    {
        $order = Database::fetch(
            'SELECT o.order_id, o.order_number, o.total_amount, o.delivery_fee, o.order_status,
                    o.payment_status, o.payment_method, o.tracking_number, o.carrier,
                    o.shipped_at, o.delivered_at, o.cancel_reason, o.cancelled_at, o.cancelled_by,
                    o.refund_status,
                    o.delivery_address, o.delivery_city, o.delivery_state, o.delivery_pincode,
                    o.notes, o.created_at, o.updated_at,
                    u.user_id, u.name AS customer_name, u.email, u.phone, u.company_name
             FROM orders o
             JOIN users u ON o.user_id = u.user_id AND u.tenant_id = o.tenant_id
             WHERE o.order_id = ? AND o.tenant_id = ? LIMIT 1',
            [$orderId, Database::tenantId()]
        );

        if (!$order) {
            return null;
        }

        $order['items'] = self::getItems($orderId);
        $order['total_amount']  = (float)$order['total_amount'];
        $order['delivery_fee']  = (float)$order['delivery_fee'];
        if ($withExtras) {
            $order['history']    = self::history($orderId);
            $order['fulfilment'] = self::stockAvailability($orderId, $order['items']);
        }
        return $order;
    }

    /**
     * Scoped to owner — 404 if order belongs to another user.
     */
    public static function findForUser(int $orderId, int $userId): ?array
    {
        $order = Database::fetch(
            'SELECT o.order_id, o.order_number, o.total_amount, o.delivery_fee, o.order_status,
                    o.payment_status, o.tracking_number, o.carrier, o.shipped_at, o.delivered_at,
                    o.cancel_reason, o.cancelled_at, o.refund_status,
                    o.delivery_address, o.delivery_city, o.delivery_state,
                    o.delivery_pincode, o.notes, o.created_at, o.updated_at
             FROM orders o
             WHERE o.order_id = ? AND o.user_id = ? AND o.tenant_id = ? LIMIT 1',
            [$orderId, $userId, Database::tenantId()]
        );

        if (!$order) {
            return null;
        }

        $order['items'] = self::getItems($orderId);
        $order['total_amount'] = (float)$order['total_amount'];
        $order['delivery_fee'] = (float)$order['delivery_fee'];
        $order['history']      = self::history($orderId);
        return $order;
    }

    /**
     * Paginated orders for a user with optional status filter and sort.
     */
    public static function forUser(int $userId, array $filters = [], int $page = 1, int $limit = 10): array
    {
        $where  = ['o.user_id = ?', 'o.tenant_id = ?'];
        $params = [$userId, Database::tenantId()];

        if (!empty($filters['status'])) {
            $where[]  = 'o.order_status = ?';
            $params[] = strtolower($filters['status']);
        }

        $allowedSort  = ['order_date' => 'o.created_at', 'total_amount' => 'o.total_amount', 'order_status' => 'o.order_status'];
        $sortField    = $allowedSort[$filters['sort'] ?? 'order_date'] ?? 'o.created_at';
        $sortDir      = strtoupper($filters['order'] ?? 'desc') === 'ASC' ? 'ASC' : 'DESC';

        $whereClause = implode(' AND ', $where);
        $total       = Database::count("SELECT COUNT(*) AS cnt FROM orders o WHERE $whereClause", $params);
        $offset      = ($page - 1) * $limit;

        $rows = Database::fetchAll(
            "SELECT o.order_id, o.order_number, o.total_amount, o.delivery_fee, o.order_status,
                    o.payment_status, o.payment_method, o.tracking_number, o.carrier,
                    o.shipped_at, o.delivered_at, o.cancel_reason, o.cancelled_at, o.refund_status,
                    o.delivery_address, o.delivery_city, o.delivery_state, o.delivery_pincode,
                    o.notes, o.created_at, o.updated_at,
                    COUNT(oi.item_id) AS total_items
             FROM orders o
             LEFT JOIN order_items oi ON o.order_id = oi.order_id AND oi.tenant_id = o.tenant_id
             WHERE $whereClause
             GROUP BY o.order_id
             ORDER BY $sortField $sortDir
             LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );

        foreach ($rows as &$r) {
            $r['total_amount'] = (float)$r['total_amount'];
            $r['delivery_fee'] = (float)$r['delivery_fee'];
            $r['total_items']  = (int)$r['total_items'];
            $r['items'] = self::getItems((int)$r['order_id']);
        }

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * Get all orders (admin) with pagination.
     */
    public static function all(array $filters = [], int $page = 1, int $limit = 10): array
    {
        $where  = ['o.tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['status'])) {
            $where[]  = 'o.order_status = ?';
            $params[] = strtolower($filters['status']);
        }

        $whereClause = implode(' AND ', $where);
        $total       = Database::count("SELECT COUNT(*) AS cnt FROM orders o WHERE $whereClause", $params);
        $offset      = ($page - 1) * $limit;

        $rows = Database::fetchAll(
            "SELECT o.order_id, o.order_number, o.total_amount, o.delivery_fee, o.order_status,
                    o.payment_status, o.payment_method, o.tracking_number, o.carrier,
                    o.shipped_at, o.delivered_at, o.cancel_reason, o.cancelled_at, o.refund_status,
                    o.created_at, u.name AS customer_name, u.email, u.phone, u.company_name,
                    COUNT(oi.item_id) AS total_items
             FROM orders o
             JOIN users u ON o.user_id = u.user_id AND u.tenant_id = o.tenant_id
             LEFT JOIN order_items oi ON o.order_id = oi.order_id AND oi.tenant_id = o.tenant_id
             WHERE $whereClause
             GROUP BY o.order_id
             ORDER BY o.created_at DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );

        foreach ($rows as &$r) {
            $r['total_amount'] = (float)$r['total_amount'];
            $r['delivery_fee'] = (float)$r['delivery_fee'];
            $r['total_items']  = (int)$r['total_items'];
        }

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * Enforces the legal order state machine (self::TRANSITIONS), persists
     * tracking/carrier/cancellation lifecycle fields, and records every
     * transition in order_status_history for the timeline UI.
     *
     * @throws AppException 404 if the order doesn't exist, 422 if cancelling
     *                       without a reason, 409 if the transition is illegal.
     */
    public static function updateStatus(
        int $orderId,
        string $newStatus,
        ?string $trackingNumber = null,
        ?string $cancelReason = null,
        ?string $carrier = null,
        ?int $changedBy = null
    ): void {
        $order = Database::fetch('SELECT order_status FROM orders WHERE order_id = ? AND tenant_id = ? LIMIT 1', [$orderId, Database::tenantId()]);
        if (!$order) {
            throw new AppException('Order not found', 404);
        }

        $from = strtolower($order['order_status']);
        $to   = strtolower($newStatus);

        if (!self::isLegalTransition($from, $to)) {
            throw new AppException(
                "Illegal order status transition: '{$order['order_status']}' -> '{$newStatus}'",
                409
            );
        }

        if ($to === 'cancelled' && ($cancelReason === null || trim($cancelReason) === '')) {
            throw new AppException('cancel_reason is required when cancelling an order', 422);
        }

        $sets   = ['order_status = ?', 'updated_at = NOW()'];
        $params = [$to];

        if ($to === 'shipped') {
            if ($trackingNumber !== null) {
                $sets[]   = 'tracking_number = ?';
                $params[] = $trackingNumber;
            }
            if ($carrier !== null) {
                $sets[]   = 'carrier = ?';
                $params[] = $carrier;
            }
            $sets[] = 'shipped_at = NOW()';
        }

        if ($to === 'delivered') {
            $sets[] = 'delivered_at = NOW()';
        }

        if ($to === 'cancelled') {
            $sets[]   = 'cancel_reason = ?';
            $params[] = $cancelReason;
            $sets[]   = 'cancelled_at = NOW()';
            if ($changedBy !== null) {
                $sets[]   = 'cancelled_by = ?';
                $params[] = $changedBy;
            }
        }

        if (in_array($to, ['cancelled', 'returned'], true)) {
            $sets[]   = 'refund_status = ?';
            $params[] = 'Initiated';
        }

        $params[] = $orderId;
        $params[] = Database::tenantId();
        Database::execute('UPDATE orders SET ' . implode(', ', $sets) . ' WHERE order_id = ? AND tenant_id = ?', $params);

        $note = $to === 'shipped'
            ? trim(implode(' ', array_filter([
                $trackingNumber ? "tracking: $trackingNumber" : null,
                $carrier ? "carrier: $carrier" : null,
              ])))
            : ($to === 'cancelled' ? $cancelReason : null);

        Database::insertTenant('order_status_history', [
            'order_id'    => $orderId,
            'from_status' => $order['order_status'],
            'to_status'   => $newStatus,
            'changed_by'  => $changedBy,
            'note'        => $note ?: null,
            'created_at'  => date('Y-m-d H:i:s'),
        ]);

        Database::insertTenant('audit_log', [
            'user_id'    => $changedBy,
            'action'     => 'ORDER_STATUS_UPDATED',
            'table_name' => 'orders',
            'record_id'  => $orderId,
            'old_value'  => $order['order_status'],
            'new_value'  => $newStatus,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Full status timeline for an order, oldest first.
     */
    public static function history(int $orderId): array
    {
        return Database::fetchAll(
            'SELECT h.history_id, h.from_status, h.to_status, h.note, h.created_at,
                    u.name AS changed_by_name
             FROM order_status_history h
             LEFT JOIN users u ON h.changed_by = u.user_id AND u.tenant_id = h.tenant_id
             WHERE h.order_id = ? AND h.tenant_id = ?
             ORDER BY h.created_at ASC, h.history_id ASC',
            [$orderId, Database::tenantId()]
        );
    }

    /**
     * Records a customer-notification delivery attempt (shipped/delivered
     * emails) so staff can see whether the automated update actually sent.
     */
    public static function recordNotification(int $orderId, string $event, ?string $email, bool $sent): void
    {
        Database::insertTenant('order_notifications', [
            'order_id'        => $orderId,
            'event'           => $event,
            'recipient_email' => $email,
            'status'          => $sent ? 'sent' : 'failed',
            'created_at'      => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Read-only, tenant-scoped stock-availability check for every line item
     * of an order, joined against Smart Inventory (inventory_products /
     * inventory_stock) when a mapping exists. Flags shortfalls and suggests
     * the next action so staff don't have to cross-check inventory manually.
     * Never writes to inventory tables — purely advisory.
     *
     * @param array|null $items Pre-fetched order items (from self::getItems);
     *                          fetched automatically when omitted.
     */
    public static function stockAvailability(int $orderId, ?array $items = null): array
    {
        $items = $items ?? self::getItems($orderId);
        $tenantId = Database::tenantId();

        $lines = [];
        $hasShortfall = false;

        foreach ($items as $item) {
            $productId = (int)$item['product_id'];
            $needed    = (float)$item['quantity'];

            $invProduct = Database::fetch(
                'SELECT inv_product_id, reorder_level, reorder_quantity
                 FROM inventory_products
                 WHERE source_product_id = ? AND tenant_id = ? AND is_deleted = 0 LIMIT 1',
                [$productId, $tenantId]
            );

            if ($invProduct === null) {
                // No Smart Inventory mapping for this product — can't verify, so
                // surface it as "unknown" rather than silently assuming OK.
                $lines[] = [
                    'product_id'      => $productId,
                    'product_name'    => $item['product_name'] ?? null,
                    'needed_quantity' => $needed,
                    'available_quantity' => null,
                    'shortfall'       => null,
                    'status'          => 'unknown',
                    'suggested_action'=> 'No inventory mapping found for this product — verify stock manually.',
                ];
                continue;
            }

            $invProductId = (int)$invProduct['inv_product_id'];
            $stock = Database::fetch(
                'SELECT COALESCE(SUM(available_quantity), 0) AS qty
                 FROM inventory_stock WHERE inv_product_id = ? AND tenant_id = ?',
                [$invProductId, $tenantId]
            );
            $available = (float)($stock['qty'] ?? 0);
            $shortfall = max(0, $needed - $available);

            if ($shortfall > 0) {
                $hasShortfall = true;
                $status = 'shortfall';
                $action = $available > 0
                    ? sprintf('Partial stock only (%.2f of %.2f available) — raise a reorder or split the shipment.', $available, $needed)
                    : 'Out of stock — raise a purchase/reorder request before confirming dispatch.';
            } elseif ($available - $needed <= (float)$invProduct['reorder_level']) {
                $status = 'low_after_fulfilment';
                $action = 'Stock covers this order but will drop to/below reorder level — consider raising a reorder.';
            } else {
                $status = 'ok';
                $action = 'Sufficient stock — ready to pick/pack.';
            }

            $lines[] = [
                'product_id'         => $productId,
                'product_name'       => $item['product_name'] ?? null,
                'needed_quantity'    => $needed,
                'available_quantity' => $available,
                'shortfall'          => $shortfall,
                'status'             => $status,
                'suggested_action'   => $action,
            ];
        }

        return [
            'has_shortfall'    => $hasShortfall,
            'lines'            => $lines,
            'overall_suggestion' => $hasShortfall
                ? 'One or more items are short — raise a reorder before promising a ship date.'
                : 'All mapped items have sufficient stock — safe to proceed to processing/shipment.',
        ];
    }

    /**
     * @throws AppException
     */
    public static function updateRefundStatus(int $orderId, string $refundStatus): void
    {
        $allowed = ['N/A', 'Initiated', 'Processed'];
        if (!in_array($refundStatus, $allowed, true)) {
            throw new AppException('Invalid refund status', 422);
        }

        $order = Database::fetch('SELECT order_id FROM orders WHERE order_id = ? AND tenant_id = ? LIMIT 1', [$orderId, Database::tenantId()]);
        if (!$order) {
            throw new AppException('Order not found', 404);
        }

        Database::execute(
            'UPDATE orders SET refund_status = ?, updated_at = NOW() WHERE order_id = ? AND tenant_id = ?',
            [$refundStatus, $orderId, Database::tenantId()]
        );
    }

    private static function getItems(int $orderId): array
    {
        $items = Database::fetchAll(
            'SELECT oi.item_id, oi.product_id, oi.config_id, oi.quantity, oi.unit_price,
                    oi.total_price, oi.size, oi.purpose, oi.sub_purpose,
                    p.product_name, p.product_type
             FROM order_items oi
             JOIN products p ON oi.product_id = p.product_id AND p.tenant_id = oi.tenant_id
             WHERE oi.order_id = ? AND oi.tenant_id = ?',
            [$orderId, Database::tenantId()]
        );
        foreach ($items as &$item) {
            $item['unit_price']  = (float)$item['unit_price'];
            $item['total_price'] = (float)$item['total_price'];
        }
        return $items;
    }
}
