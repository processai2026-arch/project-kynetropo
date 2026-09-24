<?php
declare(strict_types=1);

class PurchaseOrder
{
    public const STATUSES = ['draft', 'issued', 'partially_received', 'received', 'billed', 'paid', 'cancelled', 'short_closed'];

    public static function all(array $filters, int $page, int $limit): array
    {
        $page = max(1, $page);
        $limit = min(100, max(1, $limit));
        $where = ['po.tenant_id = ?'];        // tenant isolation
        $params = [Database::tenantId()];

        if (!empty($filters['status']) && in_array($filters['status'], self::STATUSES, true)) {
            $where[] = 'po.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['vendor_id'])) {
            $where[] = 'po.vendor_id = ?';
            $params[] = (int)$filters['vendor_id'];
        }
        if (!empty($filters['from'])) {
            $where[] = 'po.order_date >= ?';
            $params[] = $filters['from'];
        }
        if (!empty($filters['to'])) {
            $where[] = 'po.order_date <= ?';
            $params[] = $filters['to'];
        }

        $whereClause = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM purchase_orders po WHERE $whereClause", $params);
        $rows = Database::fetchAll(
            "SELECT po.*, v.name AS vendor_name, v.vendor_code
             FROM purchase_orders po
             JOIN vendors v ON v.vendor_id = po.vendor_id AND v.tenant_id = po.tenant_id
             WHERE $whereClause
             ORDER BY po.created_at DESC, po.po_id DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );

        return [
            'rows' => array_map([self::class, 'formatSummary'], $rows),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => (int)ceil($total / $limit),
            ],
        ];
    }

    public static function findById(int $id): ?array
    {
        $row = Database::fetch(
            "SELECT po.*, v.name AS vendor_name, v.vendor_code
             FROM purchase_orders po
             JOIN vendors v ON v.vendor_id = po.vendor_id AND v.tenant_id = po.tenant_id
             WHERE po.po_id = ? AND po.tenant_id = ?
             LIMIT 1",
            [$id, Database::tenantId()]
        );
        if (!$row) {
            return null;
        }

        $row['items'] = self::items($id);
        $row['receipts'] = self::receipts($id);

        return self::formatDetail($row);
    }

    public static function create(array $data, array $items): int
    {
        $totals = self::totals($items, (float)$data['other_charges']);
        // insertTenant() auto-stamps tenant_id from the current context.
        $id = Database::insertTenant('purchase_orders', [
            'po_number'           => $data['po_number'],
            'reference_number'    => $data['reference_number'] ?: null,
            'vendor_id'           => $data['vendor_id'],
            'pr_id'               => $data['pr_id'] ?: null,
            'order_date'          => $data['order_date'],
            'expected_date'       => $data['expected_date'] ?: null,
            'shipment_preference' => $data['shipment_preference'] ?: null,
            'deliver_to_type'     => $data['deliver_to_type'] ?: null,
            'deliver_to_name'     => $data['deliver_to_name'] ?: null,
            'deliver_to_address'  => $data['deliver_to_address'] ?: null,
            'payment_terms'       => $data['payment_terms'] ?: null,
            'seller_state'        => $data['seller_state'] ?: null,
            'vendor_state'        => $data['vendor_state'] ?: null,
            'vendor_gstin'        => $data['vendor_gstin'] ?: null,
            'gst_treatment'       => $data['gst_treatment'] ?: null,
            'reverse_charge'      => (int)($data['reverse_charge'] ?? 0),
            'subtotal'            => $totals['subtotal'],
            'tax_amount'          => $totals['tax_amount'],
            'other_charges'       => $totals['other_charges'],
            'total'               => $totals['total'],
            'status'              => 'draft',
            'payment_status'      => 'unpaid',
            'notes'               => $data['notes'] ?: null,
            'terms_conditions'    => $data['terms_conditions'] ?: null,
            'created_by'          => $data['created_by'] ?? null,
            'created_at'          => date('Y-m-d H:i:s'),
        ]);

        self::replaceItems($id, $items);
        return $id;
    }

    public static function updateDraft(int $id, array $data, ?array $items): void
    {
        if ($items !== null) {
            self::replaceItems($id, $items);
        }
        if ($items !== null || array_key_exists('other_charges', $data)) {
            $currentItems = self::itemsRaw($id);
            $totals = self::totals($currentItems, (float)($data['other_charges'] ?? self::raw($id)['other_charges']));
            $data['subtotal'] = $totals['subtotal'];
            $data['tax_amount'] = $totals['tax_amount'];
            $data['other_charges'] = $totals['other_charges'];
            $data['total'] = $totals['total'];
        }

        $fields = [];
        $params = [];
        foreach ([
            'po_number', 'reference_number', 'vendor_id', 'pr_id', 'order_date', 'expected_date',
            'shipment_preference', 'deliver_to_type', 'deliver_to_name', 'deliver_to_address',
            'payment_terms', 'seller_state', 'vendor_state', 'vendor_gstin', 'gst_treatment',
            'reverse_charge', 'subtotal', 'tax_amount', 'other_charges', 'total', 'notes', 'terms_conditions',
        ] as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $fields[] = "$field = ?";
            $params[] = in_array($field, [
                'pr_id', 'reference_number', 'expected_date', 'shipment_preference', 'deliver_to_type',
                'deliver_to_name', 'deliver_to_address', 'payment_terms', 'seller_state', 'vendor_state',
                'vendor_gstin', 'gst_treatment', 'notes', 'terms_conditions',
            ], true) && $data[$field] === ''
                ? null
                : $data[$field];
        }

        if (!empty($fields)) {
            $params[] = $id;
            $params[] = Database::tenantId();
            Database::execute(
                'UPDATE purchase_orders SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE po_id = ? AND tenant_id = ?',
                $params
            );
        }
    }

    public static function transition(int $id, string $status): void
    {
        Database::execute('UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE po_id = ? AND tenant_id = ?', [$status, $id, Database::tenantId()]);
    }

    public static function createReceipt(int $poId, array $data, array $lines): int
    {
        // insertTenant() auto-stamps tenant_id from the current context.
        $grnId = Database::insertTenant('goods_receipts', [
            'grn_number'  => $data['grn_number'],
            'po_id'       => $poId,
            'received_on' => $data['received_on'],
            'received_by' => $data['received_by'] ?? null,
            'status'      => 'posted',
            'notes'       => $data['notes'] ?: null,
            'created_at'  => date('Y-m-d H:i:s'),
        ]);

        foreach ($lines as $line) {
            // Lock the PO line and re-verify outstanding inside the transaction so two
            // concurrent receipts on the same line can't both pass the pre-check and over-receive.
            $current = Database::fetch(
                'SELECT quantity, received_qty FROM purchase_order_items WHERE item_id = ? AND po_id = ? AND tenant_id = ? FOR UPDATE',
                [$line['po_item_id'], $poId, Database::tenantId()]
            );
            if (!$current) {
                Response::error('Receipt item does not belong to this PO', 422);
            }
            $outstanding = (float)$current['quantity'] - (float)$current['received_qty'];
            if ($line['quantity'] > $outstanding + 0.0005) {
                Response::error('Receipt quantity exceeds outstanding (' . $outstanding . ') for a PO line', 409);
            }

            Database::insertTenant('goods_receipt_items', [
                'grn_id'     => $grnId,
                'po_item_id' => $line['po_item_id'],
                'quantity'   => $line['quantity'],
                'unit_cost'  => $line['unit_cost'],
            ]);
            Database::execute(
                'UPDATE purchase_order_items
                 SET received_qty = received_qty + ?
                 WHERE item_id = ? AND tenant_id = ?',
                [$line['quantity'], $line['po_item_id'], Database::tenantId()]
            );

            if ($line['product_id']) {
                Inventory::postMovement([
                    'product_id' => $line['product_id'],
                    'location_id' => $data['location_id'],
                    'direction' => 'in',
                    'quantity' => $line['quantity'],
                    'unit_cost' => $line['unit_cost'],
                    'ref_type' => 'grn',
                    'ref_id' => $grnId,
                    'note' => 'GRN ' . $data['grn_number'],
                    'created_by' => $data['received_by'] ?? null,
                ]);
            }
        }

        self::refreshReceiptStatus($poId);
        return $grnId;
    }

    public static function voidReceipt(int $grnId, int $actorId, string $reason): void
    {
        $receipt = self::receipt($grnId);
        if (!$receipt) {
            Response::error('Goods receipt not found', 404);
        }
        if ($receipt['status'] !== 'posted') {
            Response::error('Goods receipt is already voided', 409);
        }

        $items = Database::fetchAll(
            "SELECT gri.*, poi.product_id, poi.unit_price
             FROM goods_receipt_items gri
             JOIN purchase_order_items poi ON poi.item_id = gri.po_item_id AND poi.tenant_id = gri.tenant_id
             WHERE gri.grn_id = ? AND gri.tenant_id = ?",
            [$grnId, Database::tenantId()]
        );

        foreach ($items as $item) {
            Database::execute(
                'UPDATE purchase_order_items
                 SET received_qty = GREATEST(0, received_qty - ?)
                 WHERE item_id = ? AND tenant_id = ?',
                [(float)$item['quantity'], (int)$item['po_item_id'], Database::tenantId()]
            );
        }

        $movements = Database::fetchAll(
            'SELECT * FROM stock_movements WHERE ref_type = "grn" AND ref_id = ? AND direction = "in" AND tenant_id = ?',
            [$grnId, Database::tenantId()]
        );
        foreach ($movements as $movement) {
            Inventory::postMovement([
                'product_id' => (int)$movement['product_id'],
                'location_id' => (int)$movement['location_id'],
                'direction' => 'out',
                'quantity' => (float)$movement['quantity'],
                'unit_cost' => $movement['unit_cost'] !== null ? (float)$movement['unit_cost'] : null,
                'ref_type' => 'grn_void',
                'ref_id' => $grnId,
                'note' => 'Void GRN ' . $receipt['grn_number'] . ': ' . $reason,
                'created_by' => $actorId,
            ]);
        }

        Database::execute(
            'UPDATE goods_receipts
             SET status = "void", voided_by = ?, voided_at = NOW(), void_reason = ?
             WHERE grn_id = ? AND tenant_id = ?',
            [$actorId, $reason, $grnId, Database::tenantId()]
        );
        self::refreshReceiptStatus((int)$receipt['po_id']);
    }

    public static function raw(int $id): ?array
    {
        return Database::fetch('SELECT * FROM purchase_orders WHERE po_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
    }

    public static function itemsRaw(int $id): array
    {
        return Database::fetchAll('SELECT * FROM purchase_order_items WHERE po_id = ? AND tenant_id = ? ORDER BY sort_order ASC, item_id ASC', [$id, Database::tenantId()]);
    }

    public static function items(int $id): array
    {
        return Database::fetchAll(
            'SELECT poi.*, p.product_name
             FROM purchase_order_items poi
             LEFT JOIN products p ON p.product_id = poi.product_id AND p.tenant_id = poi.tenant_id
             WHERE poi.po_id = ? AND poi.tenant_id = ?
             ORDER BY poi.sort_order ASC, poi.item_id ASC',
            [$id, Database::tenantId()]
        );
    }

    public static function receipt(int $grnId): ?array
    {
        return Database::fetch('SELECT * FROM goods_receipts WHERE grn_id = ? AND tenant_id = ? LIMIT 1', [$grnId, Database::tenantId()]);
    }

    public static function receipts(int $poId): array
    {
        $rows = Database::fetchAll(
            'SELECT gr.*, u.name AS received_by_name
             FROM goods_receipts gr
             LEFT JOIN users u ON u.user_id = gr.received_by AND u.tenant_id = gr.tenant_id
             WHERE gr.po_id = ? AND gr.tenant_id = ?
             ORDER BY gr.created_at DESC, gr.grn_id DESC',
            [$poId, Database::tenantId()]
        );

        foreach ($rows as &$row) {
            $row['items'] = Database::fetchAll(
                'SELECT gri.*, poi.description, poi.product_id
                 FROM goods_receipt_items gri
                 JOIN purchase_order_items poi ON poi.item_id = gri.po_item_id AND poi.tenant_id = gri.tenant_id
                 WHERE gri.grn_id = ? AND gri.tenant_id = ?',
                [(int)$row['grn_id'], Database::tenantId()]
            );
        }

        return $rows;
    }

    public static function receiptList(array $filters, int $page, int $limit): array
    {
        $page = max(1, $page);
        $limit = min(100, max(1, $limit));
        $where = ['gr.tenant_id = ?'];        // tenant isolation
        $params = [Database::tenantId()];
        if (!empty($filters['po_id'])) {
            $where[] = 'gr.po_id = ?';
            $params[] = (int)$filters['po_id'];
        }

        $whereClause = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM goods_receipts gr WHERE $whereClause", $params);
        $rows = Database::fetchAll(
            "SELECT gr.*, po.po_number, v.name AS vendor_name
             FROM goods_receipts gr
             JOIN purchase_orders po ON po.po_id = gr.po_id AND po.tenant_id = gr.tenant_id
             JOIN vendors v ON v.vendor_id = po.vendor_id AND v.tenant_id = po.tenant_id
             WHERE $whereClause
             ORDER BY gr.created_at DESC, gr.grn_id DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );

        return [
            'rows' => array_map([self::class, 'formatReceiptSummary'], $rows),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => (int)ceil($total / $limit),
            ],
        ];
    }

    public static function refreshReceiptStatus(int $poId): void
    {
        $row = Database::fetch(
            'SELECT COUNT(*) AS cnt,
                    SUM(CASE WHEN received_qty > 0 THEN 1 ELSE 0 END) AS received_lines,
                    SUM(CASE WHEN received_qty + 0.0005 >= quantity THEN 1 ELSE 0 END) AS complete_lines
             FROM purchase_order_items
             WHERE po_id = ? AND tenant_id = ?',
            [$poId, Database::tenantId()]
        );
        $count = (int)($row['cnt'] ?? 0);
        $receivedLines = (int)($row['received_lines'] ?? 0);
        $completeLines = (int)($row['complete_lines'] ?? 0);
        $status = $receivedLines === 0 ? 'issued' : ($count > 0 && $completeLines === $count ? 'received' : 'partially_received');

        Database::execute('UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE po_id = ? AND tenant_id = ?', [$status, $poId, Database::tenantId()]);
    }

    public static function totals(array $items, float $otherCharges): array
    {
        $subtotal = 0.0;
        $tax = 0.0;
        foreach ($items as $item) {
            $lineTotal = round((float)$item['quantity'] * (float)$item['unit_price'], 2);
            $subtotal += $lineTotal;
            $tax += round($lineTotal * ((float)($item['gst_rate'] ?? 0) / 100), 2);
        }

        return [
            'subtotal' => round($subtotal, 2),
            'tax_amount' => round($tax, 2),
            'other_charges' => round($otherCharges, 2),
            'total' => round($subtotal + $tax + $otherCharges, 0),
        ];
    }

    public static function formatSummary(array $row): array
    {
        return [
            'po_id' => (int)$row['po_id'],
            'id' => (string)$row['po_id'],
            'po_number' => $row['po_number'],
            'reference_number' => $row['reference_number'] ?? null,
            'vendor_id' => (int)$row['vendor_id'],
            'vendor_name' => $row['vendor_name'] ?? null,
            'vendor_code' => $row['vendor_code'] ?? null,
            'pr_id' => $row['pr_id'] ? (int)$row['pr_id'] : null,
            'order_date' => $row['order_date'],
            'expected_date' => $row['expected_date'],
            'shipment_preference' => $row['shipment_preference'] ?? null,
            'deliver_to_type' => $row['deliver_to_type'] ?? null,
            'deliver_to_name' => $row['deliver_to_name'] ?? null,
            'deliver_to_address' => $row['deliver_to_address'] ?? null,
            'payment_terms' => $row['payment_terms'] ?? null,
            'seller_state' => $row['seller_state'],
            'vendor_state' => $row['vendor_state'],
            'vendor_gstin' => $row['vendor_gstin'] ?? null,
            'gst_treatment' => $row['gst_treatment'] ?? null,
            'reverse_charge' => (bool)($row['reverse_charge'] ?? false),
            'subtotal' => (float)$row['subtotal'],
            'tax_amount' => (float)$row['tax_amount'],
            'other_charges' => (float)$row['other_charges'],
            'total' => (float)$row['total'],
            'status' => $row['status'],
            'payment_status' => $row['payment_status'],
            'notes' => $row['notes'],
            'terms_conditions' => $row['terms_conditions'] ?? null,
            'created_by' => $row['created_by'] ? (int)$row['created_by'] : null,
            'billed_expense_id' => $row['billed_expense_id'] ? (int)$row['billed_expense_id'] : null,
            'delivery_status' => $row['delivery_status'] ?? 'not_sent',
            'delivered_to_email' => $row['delivered_to_email'] ?? null,
            'delivered_at' => $row['delivered_at'] ?? null,
            'delivery_attempts' => isset($row['delivery_attempts']) ? (int)$row['delivery_attempts'] : 0,
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    public static function formatDetail(array $row): array
    {
        $formatted = self::formatSummary($row);
        $formatted['items'] = array_map([self::class, 'formatItem'], $row['items'] ?? []);
        $formatted['receipts'] = array_map([self::class, 'formatReceiptDetail'], $row['receipts'] ?? []);
        $formatted['bills'] = class_exists('VendorBill') ? VendorBill::forPo((int)$row['po_id']) : [];
        $formatted['three_way_match'] = self::threeWayMatch($formatted, $formatted['bills']);

        return $formatted;
    }

    /**
     * Reconcile PO ordered vs GRN received vs vendor-bill billed quantities and
     * amounts per line. Flags a line as mismatched when received differs from
     * ordered (short/excess receipt) or billed differs from received (price or
     * quantity variance against what the vendor actually invoiced).
     */
    public static function threeWayMatch(array $po, array $bills): array
    {
        $billedByPoItem = [];
        foreach ($bills as $bill) {
            if (($bill['status'] ?? '') === 'void') {
                continue;
            }
            foreach (($bill['items'] ?? []) as $item) {
                $key = $item['po_item_id'] ?? null;
                if ($key === null) {
                    continue;
                }
                $billedByPoItem[$key]['quantity'] = ($billedByPoItem[$key]['quantity'] ?? 0) + (float)$item['quantity'];
                $billedByPoItem[$key]['amount'] = ($billedByPoItem[$key]['amount'] ?? 0) + (float)$item['line_total'];
            }
        }

        $lines = [];
        $anyMismatch = false;
        foreach (($po['items'] ?? []) as $item) {
            $ordered = (float)$item['quantity'];
            $received = (float)$item['received_qty'];
            $billed = $billedByPoItem[$item['item_id']]['quantity'] ?? 0.0;
            $billedAmount = $billedByPoItem[$item['item_id']]['amount'] ?? 0.0;
            $orderedAmount = round($ordered * (float)$item['unit_price'], 2);
            $receivedAmount = round($received * (float)$item['unit_price'], 2);

            $qtyMismatch = abs($received - $ordered) > 0.0005;
            $billMismatch = $billed > 0.0005 && abs($billed - $received) > 0.0005;
            $amountMismatch = $billed > 0.0005 && abs($billedAmount - $receivedAmount) > 0.5;
            $mismatched = $qtyMismatch || $billMismatch || $amountMismatch;
            $anyMismatch = $anyMismatch || $mismatched;

            $lines[] = [
                'item_id' => (int)$item['item_id'],
                'description' => $item['description'],
                'ordered_qty' => $ordered,
                'received_qty' => $received,
                'billed_qty' => round($billed, 3),
                'ordered_amount' => $orderedAmount,
                'received_amount' => $receivedAmount,
                'billed_amount' => round($billedAmount, 2),
                'qty_variance' => round($received - $ordered, 3),
                'bill_qty_variance' => round($billed - $received, 3),
                'bill_amount_variance' => round($billedAmount - $receivedAmount, 2),
                'matched' => !$mismatched,
            ];
        }

        $totalBilled = array_sum(array_map(fn(array $b): float => ($b['status'] ?? '') === 'void' ? 0.0 : (float)$b['total'], $bills));

        return [
            'matched' => !$anyMismatch,
            'lines' => $lines,
            'po_total' => (float)$po['total'],
            'received_total' => round(array_sum(array_column($lines, 'received_amount')), 2),
            'billed_total' => round($totalBilled, 2),
            'value_variance' => round($totalBilled - (float)$po['total'], 2),
        ];
    }

    /** Record PO document delivery (PDF generated / emailed to vendor). */
    public static function recordDelivery(int $id, string $status, ?string $email): void
    {
        Database::execute(
            'UPDATE purchase_orders
             SET delivery_status = ?, delivered_to_email = ?, delivered_at = NOW(),
                 delivery_attempts = delivery_attempts + 1, updated_at = NOW()
             WHERE po_id = ? AND tenant_id = ?',
            [$status, $email, $id, Database::tenantId()]
        );
    }

    public static function formatItem(array $row): array
    {
        return [
            'item_id' => (int)$row['item_id'],
            'id' => (string)$row['item_id'],
            'po_id' => (int)$row['po_id'],
            'description' => $row['description'],
            'product_id' => $row['product_id'] ? (int)$row['product_id'] : null,
            'product_name' => $row['product_name'] ?? null,
            'hsn_code' => $row['hsn_code'],
            'quantity' => (float)$row['quantity'],
            'received_qty' => (float)$row['received_qty'],
            'outstanding_qty' => max(0, (float)$row['quantity'] - (float)$row['received_qty']),
            'unit' => $row['unit'],
            'unit_price' => (float)$row['unit_price'],
            'gst_rate' => (float)$row['gst_rate'],
            'line_total' => (float)$row['line_total'],
            'sort_order' => (int)$row['sort_order'],
        ];
    }

    public static function formatReceiptSummary(array $row): array
    {
        return [
            'grn_id' => (int)$row['grn_id'],
            'id' => (string)$row['grn_id'],
            'grn_number' => $row['grn_number'],
            'po_id' => (int)$row['po_id'],
            'po_number' => $row['po_number'] ?? null,
            'vendor_name' => $row['vendor_name'] ?? null,
            'received_on' => $row['received_on'],
            'received_by' => $row['received_by'] ? (int)$row['received_by'] : null,
            'received_by_name' => $row['received_by_name'] ?? null,
            'status' => $row['status'],
            'notes' => $row['notes'],
            'voided_by' => $row['voided_by'] ? (int)$row['voided_by'] : null,
            'voided_at' => $row['voided_at'],
            'void_reason' => $row['void_reason'],
            'created_at' => $row['created_at'],
        ];
    }

    public static function formatReceiptDetail(array $row): array
    {
        $formatted = self::formatReceiptSummary($row);
        $formatted['items'] = array_map(function (array $item): array {
            return [
                'item_id' => (int)$item['item_id'],
                'grn_id' => (int)$item['grn_id'],
                'po_item_id' => (int)$item['po_item_id'],
                'description' => $item['description'] ?? null,
                'product_id' => $item['product_id'] ? (int)$item['product_id'] : null,
                'quantity' => (float)$item['quantity'],
                'unit_cost' => $item['unit_cost'] !== null ? (float)$item['unit_cost'] : null,
            ];
        }, $row['items'] ?? []);

        return $formatted;
    }

    private static function replaceItems(int $id, array $items): void
    {
        Database::execute('DELETE FROM purchase_order_items WHERE po_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        foreach ($items as $index => $item) {
            $lineTotal = round((float)$item['quantity'] * (float)$item['unit_price'], 2);
            // insertTenant() auto-stamps tenant_id from the current context.
            Database::insertTenant('purchase_order_items', [
                'po_id'        => $id,
                'description'  => $item['description'],
                'product_id'   => $item['product_id'] ?: null,
                'hsn_code'     => $item['hsn_code'] ?: null,
                'quantity'     => $item['quantity'],
                'received_qty' => 0,
                'unit'         => $item['unit'],
                'unit_price'   => $item['unit_price'],
                'gst_rate'     => $item['gst_rate'],
                'line_total'   => $lineTotal,
                'sort_order'   => $item['sort_order'] ?? $index,
            ]);
        }
    }
}
