<?php
declare(strict_types=1);

/**
 * Smart Inventory — on-hand balances (inventory_stock).
 *
 * Invariants enforced here (callers should already be inside a transaction when
 * mutating, mirroring AdminInventoryController::adjustment):
 *   - current_quantity and reserved_quantity can never go negative.
 *   - available_quantity is always kept = current_quantity - reserved_quantity.
 *   - is_low_stock and health_score are recomputed after every balance change.
 */
class InventoryStock
{
    public static function getStockByProduct(int $productId): array
    {
        $rows = Database::fetchAll(
            "SELECT s.*, z.zone_name, z.zone_code, z.zone_type
             FROM inventory_stock s
             JOIN inventory_zones z ON z.zone_id = s.zone_id AND z.tenant_id = ?
             WHERE s.inv_product_id = ? AND s.tenant_id = ?
             ORDER BY z.zone_name ASC",
            [Database::tenantId(), $productId, Database::tenantId()]
        );
        return array_map([self::class, 'format'], $rows);
    }

    public static function getStockByZone(int $zoneId): array
    {
        $rows = Database::fetchAll(
            "SELECT s.*, p.name AS product_name, p.sku, p.uom
             FROM inventory_stock s
             JOIN inventory_products p ON p.inv_product_id = s.inv_product_id AND p.tenant_id = ?
             WHERE s.zone_id = ? AND p.is_deleted = 0 AND s.tenant_id = ?
             ORDER BY p.name ASC",
            [Database::tenantId(), $zoneId, Database::tenantId()]
        );
        return array_map([self::class, 'format'], $rows);
    }

    /**
     * Add (positive) or remove (negative) on-hand quantity for a product/zone,
     * creating the balance row if it does not yet exist. Throws if the resulting
     * current_quantity would be negative.
     */
    public static function upsertStock(int $productId, int $zoneId, float $quantity): bool
    {
        $quantity = round($quantity, 3);
        $existing = self::rowForUpdate($productId, $zoneId);

        if ($existing === null) {
            if ($quantity < 0) {
                throw new RuntimeException('Insufficient stock: no balance exists for this product/zone');
            }
            Database::insertTenant('inventory_stock', [
                'inv_product_id'     => $productId,
                'zone_id'            => $zoneId,
                'current_quantity'   => $quantity,
                'reserved_quantity'  => 0,
                'available_quantity' => $quantity,
                'last_movement_at'   => date('Y-m-d H:i:s'),
            ]);
        } else {
            $newCurrent = round((float)$existing['current_quantity'] + $quantity, 3);
            if ($newCurrent < 0) {
                throw new RuntimeException('Insufficient stock: quantity cannot go negative');
            }
            $reserved  = (float)$existing['reserved_quantity'];
            $available = max(0.0, round($newCurrent - $reserved, 3));
            Database::execute(
                "UPDATE inventory_stock
                 SET current_quantity = ?, available_quantity = ?, last_movement_at = NOW()
                 WHERE stock_id = ? AND tenant_id = ?",
                [$newCurrent, $available, (int)$existing['stock_id'], Database::tenantId()]
            );
        }

        self::recompute($productId, $zoneId);
        return true;
    }

    public static function reserveStock(int $productId, int $zoneId, float $quantity): bool
    {
        $quantity = round($quantity, 3);
        if ($quantity <= 0) {
            throw new RuntimeException('Reserve quantity must be positive');
        }
        $row = self::rowForUpdate($productId, $zoneId);
        if ($row === null) {
            throw new RuntimeException('No stock to reserve for this product/zone');
        }
        $available = (float)$row['current_quantity'] - (float)$row['reserved_quantity'];
        if ($quantity > $available) {
            throw new RuntimeException('Cannot reserve more than available stock');
        }
        $newReserved  = round((float)$row['reserved_quantity'] + $quantity, 3);
        $newAvailable = max(0.0, round((float)$row['current_quantity'] - $newReserved, 3));
        Database::execute(
            "UPDATE inventory_stock
             SET reserved_quantity = ?, available_quantity = ?
             WHERE stock_id = ? AND tenant_id = ?",
            [$newReserved, $newAvailable, (int)$row['stock_id'], Database::tenantId()]
        );
        self::recompute($productId, $zoneId);
        return true;
    }

    public static function releaseReserved(int $productId, int $zoneId, float $quantity): bool
    {
        $quantity = round($quantity, 3);
        if ($quantity <= 0) {
            throw new RuntimeException('Release quantity must be positive');
        }
        $row = self::rowForUpdate($productId, $zoneId);
        if ($row === null) {
            throw new RuntimeException('No stock row for this product/zone');
        }
        $newReserved = round((float)$row['reserved_quantity'] - $quantity, 3);
        if ($newReserved < 0) {
            $newReserved = 0.0; // never release more than is reserved
        }
        $newAvailable = max(0.0, round((float)$row['current_quantity'] - $newReserved, 3));
        Database::execute(
            "UPDATE inventory_stock
             SET reserved_quantity = ?, available_quantity = ?
             WHERE stock_id = ? AND tenant_id = ?",
            [$newReserved, $newAvailable, (int)$row['stock_id'], Database::tenantId()]
        );
        self::recompute($productId, $zoneId);
        return true;
    }

    public static function getLowStockProducts(): array
    {
        $rows = Database::fetchAll(
            "SELECT s.*, p.name AS product_name, p.sku, p.uom, p.reorder_level AS product_reorder_level,
                    z.zone_name, z.zone_code, z.zone_type
             FROM inventory_stock s
             JOIN inventory_products p ON p.inv_product_id = s.inv_product_id AND p.tenant_id = ?
             JOIN inventory_zones z ON z.zone_id = s.zone_id AND z.tenant_id = ?
             WHERE s.is_low_stock = 1 AND p.is_deleted = 0 AND s.tenant_id = ?
             ORDER BY s.available_quantity ASC, p.name ASC",
            [Database::tenantId(), Database::tenantId(), Database::tenantId()]
        );
        return array_map([self::class, 'format'], $rows);
    }

    /**
     * Recompute health_score + is_low_stock for every balance row of a product,
     * then return true. health_score is a simple 0-100 cover ratio against the
     * product reorder_level (intelligence layer can refine this in a later prompt).
     */
    public static function updateHealthScore(int $productId): bool
    {
        $product = Database::fetch(
            "SELECT reorder_level FROM inventory_products WHERE inv_product_id = ? AND tenant_id = ? LIMIT 1",
            [$productId, Database::tenantId()]
        );
        if ($product === null) {
            return false;
        }
        $reorder = (float)$product['reorder_level'];

        $rows = Database::fetchAll(
            "SELECT stock_id, available_quantity FROM inventory_stock WHERE inv_product_id = ? AND tenant_id = ?",
            [$productId, Database::tenantId()]
        );
        foreach ($rows as $row) {
            $available = (float)$row['available_quantity'];
            $isLow = $reorder > 0 && $available <= $reorder ? 1 : 0;
            $health = self::healthFor($available, $reorder);
            Database::execute(
                "UPDATE inventory_stock SET is_low_stock = ?, health_score = ? WHERE stock_id = ? AND tenant_id = ?",
                [$isLow, $health, (int)$row['stock_id'], Database::tenantId()]
            );
        }
        return true;
    }

    /** Validate tracking metadata before the aggregate receipt is committed. */
    public static function validateTrackedReceipt(array $product, float $quantity, array $tracking): void
    {
        $type = strtoupper((string)($product['tracking_type'] ?? 'NONE'));
        $batch = trim((string)($tracking['batch_number'] ?? ''));
        $serials = array_values(array_filter($tracking['serial_numbers'] ?? [], fn($v) => trim((string)$v) !== ''));
        $barcodes = array_values(array_filter($tracking['barcodes'] ?? [], fn($v) => trim((string)$v) !== ''));
        $expiry = trim((string)($tracking['expiry_date'] ?? ''));

        if ($type === 'BATCH' && $batch === '') {
            throw new RuntimeException('batch_number is required for batch-tracked products');
        }
        if ($type === 'SERIAL') {
            if (abs($quantity - round($quantity)) > 0.0001) {
                throw new RuntimeException('Serial-tracked stock quantity must be a whole number');
            }
            if (count($serials) !== (int)round($quantity)) {
                throw new RuntimeException('serial_numbers count must equal received quantity');
            }
            if (count(array_unique($serials)) !== count($serials)) {
                throw new RuntimeException('serial_numbers must be unique');
            }
            if ($barcodes && count($barcodes) !== count($serials)) {
                throw new RuntimeException('barcodes count must equal serial_numbers count');
            }
        }
        if (!empty($product['requires_expiry']) && $expiry === '') {
            throw new RuntimeException('expiry_date is required for this product');
        }
        if ($expiry !== '') {
            $parsedExpiry = DateTimeImmutable::createFromFormat('!Y-m-d', $expiry);
            if ($parsedExpiry === false || $parsedExpiry->format('Y-m-d') !== $expiry) {
                throw new RuntimeException('expiry_date must be a valid YYYY-MM-DD date');
            }
        }
        if (count(array_unique($barcodes)) !== count($barcodes)) {
            throw new RuntimeException('barcodes must be unique');
        }

        foreach ($serials as $serial) {
            self::assertTrackedIdentifierAvailable('serial_number', trim((string)$serial));
        }
        foreach ($barcodes as $barcode) {
            self::assertTrackedIdentifierAvailable('barcode', trim((string)$barcode));
        }
        $barcode = trim((string)($tracking['barcode'] ?? ''));
        if ($barcode !== '') {
            self::assertTrackedIdentifierAvailable('barcode', $barcode);
        }
    }

    /** Create stock-item identities without replacing the aggregate inventory_stock balance. */
    public static function createTrackedReceipt(
        array $product,
        int $zoneId,
        int $movementId,
        float $quantity,
        array $tracking
    ): array {
        self::validateTrackedReceipt($product, $quantity, $tracking);
        $type = strtoupper((string)($product['tracking_type'] ?? 'NONE'));
        $batch = self::nullableText($tracking['batch_number'] ?? null);
        $expiry = self::nullableText($tracking['expiry_date'] ?? null);
        $serials = array_values(array_filter($tracking['serial_numbers'] ?? [], fn($v) => trim((string)$v) !== ''));
        $barcodes = array_values(array_filter($tracking['barcodes'] ?? [], fn($v) => trim((string)$v) !== ''));
        $ids = [];

        if ($type === 'SERIAL') {
            foreach ($serials as $index => $serial) {
                $ids[] = self::insertTrackedItem([
                    'inv_product_id' => (int)$product['inv_product_id'],
                    'zone_id' => $zoneId,
                    'receipt_movement_id' => $movementId,
                    'batch_number' => $batch,
                    'serial_number' => trim((string)$serial),
                    'expiry_date' => $expiry,
                    'barcode' => isset($barcodes[$index]) ? trim((string)$barcodes[$index]) : null,
                    'quantity' => 1,
                    'status' => 'AVAILABLE',
                ]);
            }
            return $ids;
        }

        $barcode = self::nullableText($tracking['barcode'] ?? null);
        if ($type === 'NONE' && $barcode === null && $batch === null && $expiry === null) {
            return []; // legacy/untracked receipt remains fully supported
        }
        $ids[] = self::insertTrackedItem([
            'inv_product_id' => (int)$product['inv_product_id'],
            'zone_id' => $zoneId,
            'receipt_movement_id' => $movementId,
            'batch_number' => $batch,
            'serial_number' => null,
            'expiry_date' => $expiry,
            'barcode' => $barcode,
            'quantity' => $quantity,
            'status' => 'AVAILABLE',
        ]);
        return $ids;
    }

    /** Mirror Smart Allocation placements for the stock items created by one receipt. */
    public static function distributeTrackedReceipt(int $movementId, int $intakeZoneId, array $placements): void
    {
        $items = Database::fetchAll(
            "SELECT * FROM inventory_stock_items
             WHERE receipt_movement_id = ? AND zone_id = ? AND status = 'AVAILABLE' AND tenant_id = ?
             ORDER BY stock_item_id ASC FOR UPDATE",
            [$movementId, $intakeZoneId, Database::tenantId()]
        );
        if (!$items) {
            return;
        }

        $itemIndex = 0;
        foreach ($placements as $placement) {
            $remaining = round((float)($placement['quantity'] ?? 0), 3);
            $zoneId = (int)($placement['zone_id'] ?? 0);
            while ($remaining > 0 && isset($items[$itemIndex])) {
                $item = $items[$itemIndex];
                $available = (float)$item['quantity'];
                $take = min($remaining, $available);
                if ($take >= $available - 0.0001) {
                    Database::execute(
                        "UPDATE inventory_stock_items SET zone_id = ? WHERE stock_item_id = ? AND tenant_id = ?",
                        [$zoneId, (int)$item['stock_item_id'], Database::tenantId()]
                    );
                    $itemIndex++;
                } else {
                    Database::execute(
                        "UPDATE inventory_stock_items SET quantity = quantity - ? WHERE stock_item_id = ? AND tenant_id = ?",
                        [$take, (int)$item['stock_item_id'], Database::tenantId()]
                    );
                    $copy = $item;
                    unset($copy['stock_item_id'], $copy['tenant_id'], $copy['created_at'], $copy['updated_at']);
                    $copy['zone_id'] = $zoneId;
                    $copy['quantity'] = $take;
                    $copy['barcode'] = null; // a partial batch split cannot duplicate a unique barcode
                    self::insertTrackedItem($copy);
                    $items[$itemIndex]['quantity'] = $available - $take;
                }
                $remaining = round($remaining - $take, 3);
            }
        }
    }

    public static function lookupBarcode(string $barcode): ?array
    {
        $row = Database::fetch(
            "SELECT i.*, p.name AS product_name, p.sku, p.uom, p.tracking_type,
                    z.zone_name, z.zone_code, z.zone_type
             FROM inventory_stock_items i
             JOIN inventory_products p ON p.inv_product_id = i.inv_product_id AND p.tenant_id = i.tenant_id
             JOIN inventory_zones z ON z.zone_id = i.zone_id AND z.tenant_id = i.tenant_id
             WHERE i.barcode = ? AND i.tenant_id = ? LIMIT 1",
            [trim($barcode), Database::tenantId()]
        );
        return $row ?: null;
    }

    public static function getTrackedStock(int $productId, ?int $zoneId = null): array
    {
        $where = ['i.inv_product_id = ?', 'i.tenant_id = ?'];
        $params = [$productId, Database::tenantId()];
        if ($zoneId !== null) {
            $where[] = 'i.zone_id = ?';
            $params[] = $zoneId;
        }
        return Database::fetchAll(
            "SELECT i.*, z.zone_name, z.zone_code
             FROM inventory_stock_items i
             JOIN inventory_zones z ON z.zone_id = i.zone_id AND z.tenant_id = i.tenant_id
             WHERE " . implode(' AND ', $where) . "
             ORDER BY i.expiry_date IS NULL, i.expiry_date, i.stock_item_id",
            $params
        );
    }

    /** Reserve tracked identities into transit and persist the exact allocation. */
    public static function dispatchTrackedForTransfer(array $line, int $zoneId): void
    {
        $product = InventoryProduct::findById((int)$line['inv_product_id']);
        if ($product === null || ($product['tracking_type'] ?? 'NONE') === 'NONE') {
            return;
        }
        $where = ["inv_product_id = ?", "zone_id = ?", "status = 'AVAILABLE'", 'tenant_id = ?'];
        $params = [(int)$line['inv_product_id'], $zoneId, Database::tenantId()];
        foreach (['batch_number', 'serial_number', 'barcode'] as $field) {
            if (!empty($line[$field])) {
                $where[] = "$field = ?";
                $params[] = trim((string)$line[$field]);
            }
        }
        $items = Database::fetchAll(
            "SELECT * FROM inventory_stock_items WHERE " . implode(' AND ', $where) . "
             ORDER BY expiry_date IS NULL, expiry_date, stock_item_id FOR UPDATE",
            $params
        );
        $remaining = (float)$line['requested_quantity'];
        foreach ($items as $item) {
            if ($remaining <= 0) break;
            $available = (float)$item['quantity'];
            $take = min($available, $remaining);
            $stockItemId = (int)$item['stock_item_id'];
            if ($take < $available - 0.0001) {
                Database::execute(
                    "UPDATE inventory_stock_items SET quantity = quantity - ? WHERE stock_item_id = ? AND tenant_id = ?",
                    [$take, $stockItemId, Database::tenantId()]
                );
                $copy = $item;
                unset($copy['stock_item_id'], $copy['tenant_id'], $copy['created_at'], $copy['updated_at']);
                $copy['quantity'] = $take;
                $copy['status'] = 'IN_TRANSIT';
                $copy['barcode'] = null;
                $stockItemId = self::insertTrackedItem($copy);
            } else {
                Database::execute(
                    "UPDATE inventory_stock_items SET status = 'IN_TRANSIT' WHERE stock_item_id = ? AND tenant_id = ?",
                    [$stockItemId, Database::tenantId()]
                );
            }
            Database::insertTenant('inventory_transfer_allocations', [
                'transfer_item_id' => (int)$line['transfer_item_id'],
                'stock_item_id' => $stockItemId,
                'quantity' => $take,
                'received_quantity' => 0,
            ]);
            $remaining = round($remaining - $take, 3);
        }
        if ($remaining > 0.0001) {
            throw new RuntimeException('Insufficient matching batch/serial stock for transfer');
        }
    }

    public static function receiveTrackedTransfer(int $transferItemId, int $zoneId): void
    {
        $rows = Database::fetchAll(
            "SELECT a.* FROM inventory_transfer_allocations a
             WHERE a.transfer_item_id = ? AND a.tenant_id = ? FOR UPDATE",
            [$transferItemId, Database::tenantId()]
        );
        foreach ($rows as $row) {
            Database::execute(
                "UPDATE inventory_stock_items SET zone_id = ?, status = 'AVAILABLE'
                 WHERE stock_item_id = ? AND status = 'IN_TRANSIT' AND tenant_id = ?",
                [$zoneId, (int)$row['stock_item_id'], Database::tenantId()]
            );
            Database::execute(
                "UPDATE inventory_transfer_allocations SET received_quantity = quantity
                 WHERE transfer_allocation_id = ? AND tenant_id = ?",
                [(int)$row['transfer_allocation_id'], Database::tenantId()]
            );
        }
    }

    private static function insertTrackedItem(array $data): int
    {
        return Database::insertTenant('inventory_stock_items', $data);
    }

    private static function assertTrackedIdentifierAvailable(string $column, string $value): void
    {
        if ($value === '') return;
        $exists = Database::count(
            "SELECT COUNT(*) AS cnt FROM inventory_stock_items WHERE $column = ? AND tenant_id = ?",
            [$value, Database::tenantId()]
        );
        if ($exists > 0) {
            throw new RuntimeException(str_replace('_', ' ', $column) . ' already exists');
        }
    }

    private static function nullableText(mixed $value): ?string
    {
        $text = trim((string)($value ?? ''));
        return $text === '' ? null : $text;
    }

    private static function recompute(int $productId, int $zoneId): void
    {
        // Scoped recompute for the single zone touched; cheaper than the full product sweep.
        $product = Database::fetch(
            "SELECT reorder_level FROM inventory_products WHERE inv_product_id = ? AND tenant_id = ? LIMIT 1",
            [$productId, Database::tenantId()]
        );
        $reorder = $product !== null ? (float)$product['reorder_level'] : 0.0;

        $row = self::row($productId, $zoneId);
        if ($row === null) {
            return;
        }
        $available = (float)$row['available_quantity'];
        $isLow  = $reorder > 0 && $available <= $reorder ? 1 : 0;
        $health = self::healthFor($available, $reorder);
        Database::execute(
            "UPDATE inventory_stock SET is_low_stock = ?, health_score = ? WHERE stock_id = ? AND tenant_id = ?",
            [$isLow, $health, (int)$row['stock_id'], Database::tenantId()]
        );
    }

    private static function healthFor(float $available, float $reorder): float
    {
        if ($reorder <= 0) {
            return 100.00; // no reorder threshold defined → treat as healthy
        }
        $ratio = ($available / $reorder) * 100.0;
        return round(max(0.0, min(100.0, $ratio)), 2);
    }

    private static function row(int $productId, int $zoneId): ?array
    {
        return Database::fetch(
            "SELECT * FROM inventory_stock WHERE inv_product_id = ? AND zone_id = ? AND tenant_id = ? LIMIT 1",
            [$productId, $zoneId, Database::tenantId()]
        );
    }

    /**
     * Same as row(), but locks the matching row with FOR UPDATE so concurrent
     * balance mutations for the same product/zone serialize on this row.
     * Callers must already be inside a transaction (Database::beginTransaction()).
     */
    private static function rowForUpdate(int $productId, int $zoneId): ?array
    {
        return Database::fetch(
            "SELECT * FROM inventory_stock WHERE inv_product_id = ? AND zone_id = ? AND tenant_id = ? LIMIT 1 FOR UPDATE",
            [$productId, $zoneId, Database::tenantId()]
        );
    }

    private static function format(array $row): array
    {
        $row['is_low_stock'] = (int)($row['is_low_stock'] ?? 0) === 1;
        return $row;
    }
}
