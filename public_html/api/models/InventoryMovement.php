<?php
declare(strict_types=1);

/**
 * Smart Inventory — movement ledger (inventory_stock_movements) and the audit
 * journal (inventory_audit_log).
 *
 * Movements are append-only; corrections are new rows, never edits. The ledger
 * does not touch balances itself — the controller pairs recordMovement() with
 * InventoryStock::upsertStock() inside one transaction.
 */
class InventoryMovement
{
    public const TYPES = [
        'STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT', 'DAMAGE', 'RETURN',
        'PRODUCTION_USE', 'DEALER_ALLOCATION', 'EMPLOYEE_ISSUE', 'EMERGENCY_USE',
        'TRANSFER_DISPATCH', 'TRANSFER_RECEIVE',
    ];

    public const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

    public static function recordMovement(array $data): int
    {
        $quantity = (float)$data['quantity'];
        $unitCost = (float)($data['unit_cost'] ?? 0);

        return Database::insertTenant('inventory_stock_movements', [
            'inv_product_id'  => (int)$data['inv_product_id'],
            'zone_id'         => (int)$data['zone_id'],
            'movement_type'   => (string)$data['movement_type'],
            'quantity'        => $quantity,
            'unit_cost'       => $unitCost,
            'total_value'     => round($quantity * $unitCost, 2),
            'reference_type'  => isset($data['reference_type']) && $data['reference_type'] !== ''
                ? (string)$data['reference_type'] : null,
            'reference_id'    => isset($data['reference_id']) && $data['reference_id'] !== ''
                ? (int)$data['reference_id'] : null,
            'dealer_id'       => isset($data['dealer_id']) && $data['dealer_id'] !== '' ? (int)$data['dealer_id'] : null,
            'moved_by'        => isset($data['moved_by']) && $data['moved_by'] !== '' ? (int)$data['moved_by'] : null,
            'approved_by'     => isset($data['approved_by']) && $data['approved_by'] !== '' ? (int)$data['approved_by'] : null,
            'approval_status' => (string)($data['approval_status'] ?? 'APPROVED'),
            'remarks'         => isset($data['remarks']) && $data['remarks'] !== '' ? trim((string)$data['remarks']) : null,
            'attachment_url'  => isset($data['attachment_url']) && $data['attachment_url'] !== ''
                ? (string)$data['attachment_url'] : null,
        ]);
    }

    public static function getMovementsByProduct(int $productId, array $filters = []): array
    {
        $where = ['m.inv_product_id = ?', 'm.tenant_id = ?'];
        $params = [$productId, Database::tenantId()];

        if (!empty($filters['movement_type'])) {
            $where[] = 'm.movement_type = ?';
            $params[] = (string)$filters['movement_type'];
        }
        if (!empty($filters['zone_id'])) {
            $where[] = 'm.zone_id = ?';
            $params[] = (int)$filters['zone_id'];
        }
        if (!empty($filters['approval_status'])) {
            $where[] = 'm.approval_status = ?';
            $params[] = (string)$filters['approval_status'];
        }
        if (!empty($filters['from'])) {
            $where[] = 'm.created_at >= ?';
            $params[] = (string)$filters['from'];
        }
        if (!empty($filters['to'])) {
            $where[] = 'm.created_at <= ?';
            $params[] = (string)$filters['to'];
        }

        $whereClause = implode(' AND ', $where);
        $rows = Database::fetchAll(
            "SELECT m.*, z.zone_name, z.zone_code, u.name AS moved_by_name
             FROM inventory_stock_movements m
             JOIN inventory_zones z ON z.zone_id = m.zone_id AND z.tenant_id = ?
             LEFT JOIN users u ON u.user_id = m.moved_by AND u.tenant_id = ?
             WHERE $whereClause
             ORDER BY m.created_at DESC, m.movement_id DESC",
            [Database::tenantId(), Database::tenantId(), ...$params]
        );
        return $rows;
    }

    public static function getMovementsByZone(int $zoneId): array
    {
        return Database::fetchAll(
            "SELECT m.*, p.name AS product_name, p.sku, u.name AS moved_by_name
             FROM inventory_stock_movements m
             JOIN inventory_products p ON p.inv_product_id = m.inv_product_id AND p.tenant_id = ?
             LEFT JOIN users u ON u.user_id = m.moved_by AND u.tenant_id = ?
             WHERE m.zone_id = ? AND m.tenant_id = ?
             ORDER BY m.created_at DESC, m.movement_id DESC",
            [Database::tenantId(), Database::tenantId(), $zoneId, Database::tenantId()]
        );
    }

    public static function getPendingApprovals(): array
    {
        return Database::fetchAll(
            "SELECT m.*, a.approval_id, p.name AS product_name, p.sku, z.zone_name, z.zone_code,
                    u.name AS moved_by_name
             FROM inventory_stock_movements m
             JOIN inventory_approvals a ON a.movement_id = m.movement_id AND a.approval_status = 'PENDING' AND a.tenant_id = ?
             JOIN inventory_products p ON p.inv_product_id = m.inv_product_id AND p.tenant_id = ?
             JOIN inventory_zones z ON z.zone_id = m.zone_id AND z.tenant_id = ?
             LEFT JOIN users u ON u.user_id = m.moved_by AND u.tenant_id = ?
             WHERE m.approval_status = 'PENDING' AND m.tenant_id = ?
             ORDER BY m.created_at ASC, m.movement_id ASC",
            [Database::tenantId(), Database::tenantId(), Database::tenantId(), Database::tenantId(), Database::tenantId()]
        );
    }

    public static function getMovementById(int $id): ?array
    {
        $row = Database::fetch(
            "SELECT m.*, p.name AS product_name, p.sku, z.zone_name, z.zone_code
             FROM inventory_stock_movements m
             JOIN inventory_products p ON p.inv_product_id = m.inv_product_id AND p.tenant_id = ?
             JOIN inventory_zones z ON z.zone_id = m.zone_id AND z.tenant_id = ?
             WHERE m.movement_id = ? AND m.tenant_id = ?
             LIMIT 1",
            [Database::tenantId(), Database::tenantId(), $id, Database::tenantId()]
        );
        return $row ?: null;
    }

    public static function updateApprovalStatus(int $id, string $status, ?int $approvedBy): bool
    {
        return Database::execute(
            "UPDATE inventory_stock_movements
             SET approval_status = ?, approved_by = ?
             WHERE movement_id = ? AND tenant_id = ?",
            [$status, $approvedBy, $id, Database::tenantId()]
        ) > 0;
    }

    public static function createTransferOrder(array $data, ?int $actorId): array
    {
        $key = trim((string)($data['idempotency_key'] ?? ''));
        if ($key !== '') {
            $existing = Database::fetch(
                "SELECT transfer_order_id FROM inventory_transfer_orders
                 WHERE idempotency_key = ? AND tenant_id = ? LIMIT 1",
                [$key, Database::tenantId()]
            );
            if ($existing !== null) {
                return self::getTransferOrder((int)$existing['transfer_order_id']) ?? [];
            }
        }

        Database::beginTransaction();
        try {
            $id = Database::insertTenant('inventory_transfer_orders', [
                'transfer_number' => self::nextTransferNumber(),
                'from_zone_id' => (int)$data['from_zone_id'],
                'to_zone_id' => (int)$data['to_zone_id'],
                'status' => 'CREATED',
                'idempotency_key' => $key !== '' ? $key : null,
                'remarks' => isset($data['remarks']) ? trim((string)$data['remarks']) : null,
                'created_by' => $actorId,
            ]);
            foreach ($data['items'] as $item) {
                Database::insertTenant('inventory_transfer_order_items', [
                    'transfer_order_id' => $id,
                    'inv_product_id' => (int)$item['product_id'],
                    'requested_quantity' => (float)$item['quantity'],
                    'dispatched_quantity' => 0,
                    'received_quantity' => 0,
                    'batch_number' => self::nullableText($item['batch_number'] ?? null),
                    'serial_number' => self::nullableText($item['serial_number'] ?? null),
                    'barcode' => self::nullableText($item['barcode'] ?? null),
                ]);
            }
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            throw $e;
        }
        return self::getTransferOrder($id) ?? [];
    }

    public static function getTransferOrders(array $filters = []): array
    {
        $where = ['o.tenant_id = ?'];
        $params = [Database::tenantId()];
        if (!empty($filters['status'])) {
            $where[] = 'o.status = ?';
            $params[] = strtoupper(trim((string)$filters['status']));
        }
        if (!empty($filters['zone_id'])) {
            $where[] = '(o.from_zone_id = ? OR o.to_zone_id = ?)';
            $params[] = (int)$filters['zone_id'];
            $params[] = (int)$filters['zone_id'];
        }
        return Database::fetchAll(
            "SELECT o.*, f.zone_name AS from_zone_name, f.zone_code AS from_zone_code,
                    t.zone_name AS to_zone_name, t.zone_code AS to_zone_code,
                    (SELECT COUNT(*) FROM inventory_transfer_order_items ci
                     WHERE ci.transfer_order_id = o.transfer_order_id AND ci.tenant_id = o.tenant_id) AS item_count,
                    (SELECT COALESCE(SUM(si.requested_quantity), 0) FROM inventory_transfer_order_items si
                     WHERE si.transfer_order_id = o.transfer_order_id AND si.tenant_id = o.tenant_id) AS total_quantity
             FROM inventory_transfer_orders o
             JOIN inventory_zones f ON f.zone_id = o.from_zone_id AND f.tenant_id = o.tenant_id
             JOIN inventory_zones t ON t.zone_id = o.to_zone_id AND t.tenant_id = o.tenant_id
             WHERE " . implode(' AND ', $where) . "
             ORDER BY o.created_at DESC, o.transfer_order_id DESC",
            $params
        );
    }

    public static function getTransferOrder(int $id): ?array
    {
        $order = Database::fetch(
            "SELECT o.*, f.zone_name AS from_zone_name, f.zone_code AS from_zone_code,
                    t.zone_name AS to_zone_name, t.zone_code AS to_zone_code
             FROM inventory_transfer_orders o
             JOIN inventory_zones f ON f.zone_id = o.from_zone_id AND f.tenant_id = o.tenant_id
             JOIN inventory_zones t ON t.zone_id = o.to_zone_id AND t.tenant_id = o.tenant_id
             WHERE o.transfer_order_id = ? AND o.tenant_id = ? LIMIT 1",
            [$id, Database::tenantId()]
        );
        if ($order === null) return null;
        $order['items'] = Database::fetchAll(
            "SELECT i.*, p.name AS product_name, p.sku, p.uom, p.tracking_type
             FROM inventory_transfer_order_items i
             JOIN inventory_products p ON p.inv_product_id = i.inv_product_id AND p.tenant_id = i.tenant_id
             WHERE i.transfer_order_id = ? AND i.tenant_id = ? ORDER BY i.transfer_item_id",
            [$id, Database::tenantId()]
        );
        return $order;
    }

    public static function dispatchTransferOrder(int $id, ?int $actorId, ?string $ip): array
    {
        Database::beginTransaction();
        try {
            $order = self::lockTransferOrder($id);
            if ($order === null) throw new RuntimeException('Transfer order not found');
            if ($order['status'] === 'DISPATCHED') {
                Database::commit();
                return self::getTransferOrder($id) ?? [];
            }
            if ($order['status'] !== 'CREATED') {
                throw new RuntimeException('Only CREATED transfer orders can be dispatched');
            }
            $items = self::transferItems($id);
            foreach ($items as $item) {
                $qty = (float)$item['requested_quantity'];
                InventoryStock::upsertStock((int)$item['inv_product_id'], (int)$order['from_zone_id'], -$qty);
                InventoryStock::dispatchTrackedForTransfer($item, (int)$order['from_zone_id']);
                self::recordMovement([
                    'inv_product_id' => (int)$item['inv_product_id'],
                    'zone_id' => (int)$order['from_zone_id'],
                    'movement_type' => 'TRANSFER_DISPATCH',
                    'quantity' => $qty,
                    'reference_type' => 'TRANSFER_ORDER',
                    'reference_id' => $id,
                    'moved_by' => $actorId,
                    'approved_by' => $actorId,
                    'remarks' => 'Dispatched ' . $order['transfer_number'] . ' to zone #' . $order['to_zone_id'],
                ]);
                Database::execute(
                    "UPDATE inventory_transfer_order_items SET dispatched_quantity = requested_quantity
                     WHERE transfer_item_id = ? AND tenant_id = ?",
                    [(int)$item['transfer_item_id'], Database::tenantId()]
                );
            }
            Database::execute(
                "UPDATE inventory_transfer_orders
                 SET status = 'DISPATCHED', dispatched_by = ?, dispatched_at = NOW()
                 WHERE transfer_order_id = ? AND tenant_id = ?",
                [$actorId, $id, Database::tenantId()]
            );
            self::audit('inventory_transfer_orders', $id, 'DISPATCH', ['status' => 'CREATED'], ['status' => 'DISPATCHED'], $actorId, $ip);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            throw $e;
        }
        return self::getTransferOrder($id) ?? [];
    }

    public static function receiveTransferOrder(int $id, ?int $actorId, ?string $ip): array
    {
        Database::beginTransaction();
        try {
            $order = self::lockTransferOrder($id);
            if ($order === null) throw new RuntimeException('Transfer order not found');
            if ($order['status'] === 'RECEIVED') {
                Database::commit();
                return self::getTransferOrder($id) ?? [];
            }
            if ($order['status'] !== 'DISPATCHED') {
                throw new RuntimeException('Only DISPATCHED transfer orders can be received');
            }
            foreach (self::transferItems($id) as $item) {
                $qty = (float)$item['dispatched_quantity'];
                InventoryStock::upsertStock((int)$item['inv_product_id'], (int)$order['to_zone_id'], $qty);
                InventoryStock::receiveTrackedTransfer((int)$item['transfer_item_id'], (int)$order['to_zone_id']);
                self::recordMovement([
                    'inv_product_id' => (int)$item['inv_product_id'],
                    'zone_id' => (int)$order['to_zone_id'],
                    'movement_type' => 'TRANSFER_RECEIVE',
                    'quantity' => $qty,
                    'reference_type' => 'TRANSFER_ORDER',
                    'reference_id' => $id,
                    'moved_by' => $actorId,
                    'approved_by' => $actorId,
                    'remarks' => 'Received ' . $order['transfer_number'] . ' from zone #' . $order['from_zone_id'],
                ]);
                Database::execute(
                    "UPDATE inventory_transfer_order_items SET received_quantity = dispatched_quantity
                     WHERE transfer_item_id = ? AND tenant_id = ?",
                    [(int)$item['transfer_item_id'], Database::tenantId()]
                );
            }
            Database::execute(
                "UPDATE inventory_transfer_orders
                 SET status = 'RECEIVED', received_by = ?, received_at = NOW()
                 WHERE transfer_order_id = ? AND tenant_id = ?",
                [$actorId, $id, Database::tenantId()]
            );
            self::audit('inventory_transfer_orders', $id, 'RECEIVE', ['status' => 'DISPATCHED'], ['status' => 'RECEIVED'], $actorId, $ip);
            Database::commit();
        } catch (Throwable $e) {
            Database::rollBack();
            throw $e;
        }
        return self::getTransferOrder($id) ?? [];
    }

    private static function lockTransferOrder(int $id): ?array
    {
        return Database::fetch(
            "SELECT * FROM inventory_transfer_orders WHERE transfer_order_id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE",
            [$id, Database::tenantId()]
        );
    }

    private static function transferItems(int $id): array
    {
        return Database::fetchAll(
            "SELECT * FROM inventory_transfer_order_items
             WHERE transfer_order_id = ? AND tenant_id = ? ORDER BY transfer_item_id FOR UPDATE",
            [$id, Database::tenantId()]
        );
    }

    private static function nextTransferNumber(): string
    {
        return 'TO-' . date('Ymd-His') . '-' . strtoupper(bin2hex(random_bytes(2)));
    }

    private static function nullableText(mixed $value): ?string
    {
        $value = trim((string)($value ?? ''));
        return $value === '' ? null : $value;
    }

    /**
     * Append a row to inventory_audit_log. Callers already hold the request, so
     * performed_by / ip are passed in explicitly to keep this static and simple.
     */
    public static function audit(
        string $table,
        int $recordId,
        string $action,
        ?array $oldValue,
        ?array $newValue,
        ?int $performedBy,
        ?string $ip
    ): void {
        Database::insertTenant('inventory_audit_log', [
            'table_name'  => $table,
            'record_id'   => $recordId,
            'action_type' => $action,
            'old_value'   => $oldValue !== null ? json_encode($oldValue, JSON_UNESCAPED_UNICODE) : null,
            'new_value'   => $newValue !== null ? json_encode($newValue, JSON_UNESCAPED_UNICODE) : null,
            'performed_by'=> $performedBy,
            'ip_address'  => $ip,
        ]);
    }
}
