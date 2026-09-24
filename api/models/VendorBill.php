<?php
declare(strict_types=1);

/**
 * Vendor Bill — the real supplier-invoice entity that PO billing should
 * produce instead of a generic expense row. Carries bill number/date, due
 * date, line items with tax, links back to the originating PO and the GRN(s)
 * it covers, and tracks its own payment status.
 *
 * A bill may still mirror its total into `expenses` (via expense_id) purely
 * for compatibility with the existing cash/expense reporting surfaces; the
 * bill row itself is the source of truth for procurement.
 */
class VendorBill
{
    public const STATUSES = ['draft', 'approved', 'paid', 'void'];

    public static function all(array $filters, int $page, int $limit): array
    {
        $page = max(1, $page);
        $limit = min(100, max(1, $limit));
        $where = ['vb.tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['status']) && in_array($filters['status'], self::STATUSES, true)) {
            $where[] = 'vb.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['vendor_id'])) {
            $where[] = 'vb.vendor_id = ?';
            $params[] = (int)$filters['vendor_id'];
        }
        if (!empty($filters['po_id'])) {
            $where[] = 'vb.po_id = ?';
            $params[] = (int)$filters['po_id'];
        }

        $whereClause = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM vendor_bills vb WHERE $whereClause", $params);
        $rows = Database::fetchAll(
            "SELECT vb.*, v.name AS vendor_name, v.vendor_code, po.po_number
             FROM vendor_bills vb
             JOIN vendors v ON v.vendor_id = vb.vendor_id AND v.tenant_id = vb.tenant_id
             LEFT JOIN purchase_orders po ON po.po_id = vb.po_id AND po.tenant_id = vb.tenant_id
             WHERE $whereClause
             ORDER BY vb.created_at DESC, vb.bill_id DESC
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
            "SELECT vb.*, v.name AS vendor_name, v.vendor_code, v.gstin AS vendor_gstin, po.po_number
             FROM vendor_bills vb
             JOIN vendors v ON v.vendor_id = vb.vendor_id AND v.tenant_id = vb.tenant_id
             LEFT JOIN purchase_orders po ON po.po_id = vb.po_id AND po.tenant_id = vb.tenant_id
             WHERE vb.bill_id = ? AND vb.tenant_id = ?
             LIMIT 1",
            [$id, Database::tenantId()]
        );
        if (!$row) {
            return null;
        }
        $row['items'] = self::items($id);
        $row['grn_ids'] = self::grnIds($id);

        return self::formatDetail($row);
    }

    public static function forPo(int $poId): array
    {
        $rows = Database::fetchAll(
            'SELECT bill_id FROM vendor_bills WHERE po_id = ? AND tenant_id = ? ORDER BY created_at DESC, bill_id DESC',
            [$poId, Database::tenantId()]
        );
        $bills = [];
        foreach ($rows as $row) {
            $bill = self::findById((int)$row['bill_id']);
            if ($bill !== null) {
                $bills[] = $bill;
            }
        }
        return $bills;
    }

    public static function duplicateInvoiceHint(int $vendorId, string $vendorInvoiceNumber, ?int $excludeId = null): ?array
    {
        $vendorInvoiceNumber = trim($vendorInvoiceNumber);
        if ($vendorInvoiceNumber === '') {
            return null;
        }
        $sql = 'SELECT bill_id, bill_number, vendor_invoice_number FROM vendor_bills
                WHERE tenant_id = ? AND vendor_id = ? AND vendor_invoice_number = ?';
        $params = [Database::tenantId(), $vendorId, $vendorInvoiceNumber];
        if ($excludeId !== null) {
            $sql .= ' AND bill_id <> ?';
            $params[] = $excludeId;
        }
        $sql .= ' LIMIT 1';

        return Database::fetch($sql, $params);
    }

    public static function create(array $data, array $items, array $grnIds): int
    {
        $totals = self::totals($items, (float)($data['other_charges'] ?? 0));
        $id = Database::insertTenant('vendor_bills', [
            'bill_number'           => $data['bill_number'],
            'vendor_invoice_number' => $data['vendor_invoice_number'] ?: null,
            'vendor_id'             => $data['vendor_id'],
            'po_id'                 => $data['po_id'] ?: null,
            'bill_date'             => $data['bill_date'],
            'due_date'              => $data['due_date'] ?: null,
            'subtotal'              => $totals['subtotal'],
            'tax_amount'            => $totals['tax_amount'],
            'other_charges'         => $totals['other_charges'],
            'total'                 => $totals['total'],
            'amount_paid'           => 0,
            'status'                => $data['status'] ?? 'approved',
            'payment_status'        => 'unpaid',
            'notes'                 => $data['notes'] ?: null,
            'expense_id'            => $data['expense_id'] ?? null,
            'created_by'            => $data['created_by'] ?? null,
            'approved_by'           => ($data['status'] ?? 'approved') === 'approved' ? ($data['created_by'] ?? null) : null,
            'approved_at'           => ($data['status'] ?? 'approved') === 'approved' ? date('Y-m-d H:i:s') : null,
            'created_at'            => date('Y-m-d H:i:s'),
        ]);

        self::replaceItems($id, $items);
        foreach ($grnIds as $grnId) {
            Database::insertTenant('vendor_bill_grns', [
                'bill_id'    => $id,
                'grn_id'     => $grnId,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
        }

        return $id;
    }

    public static function update(int $id, array $data, ?array $items): void
    {
        if ($items !== null) {
            self::replaceItems($id, $items);
            $totals = self::totals($items, (float)($data['other_charges'] ?? self::raw($id)['other_charges']));
            $data['subtotal'] = $totals['subtotal'];
            $data['tax_amount'] = $totals['tax_amount'];
            $data['other_charges'] = $totals['other_charges'];
            $data['total'] = $totals['total'];
        }

        $fields = [];
        $params = [];
        foreach ([
            'vendor_invoice_number', 'bill_date', 'due_date', 'subtotal', 'tax_amount',
            'other_charges', 'total', 'notes',
        ] as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $fields[] = "$field = ?";
            $params[] = in_array($field, ['vendor_invoice_number', 'due_date', 'notes'], true) && $data[$field] === ''
                ? null
                : $data[$field];
        }

        if (!empty($fields)) {
            $params[] = $id;
            $params[] = Database::tenantId();
            Database::execute(
                'UPDATE vendor_bills SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE bill_id = ? AND tenant_id = ?',
                $params
            );
        }
    }

    public static function transition(int $id, string $status, ?int $actorId = null): void
    {
        if ($status === 'approved') {
            Database::execute(
                'UPDATE vendor_bills SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE bill_id = ? AND tenant_id = ?',
                [$status, $actorId, $id, Database::tenantId()]
            );
            return;
        }
        Database::execute(
            'UPDATE vendor_bills SET status = ?, updated_at = NOW() WHERE bill_id = ? AND tenant_id = ?',
            [$status, $id, Database::tenantId()]
        );
    }

    /** Recompute amount_paid/payment_status from the linked PO's vendor payments (PO is still the payment ledger anchor). */
    public static function refreshPaymentStatus(int $billId): void
    {
        $bill = self::raw($billId);
        if (!$bill) {
            return;
        }
        $paid = (float)$bill['amount_paid'];
        $status = $paid <= 0 ? 'unpaid' : ($paid + 0.0005 >= (float)$bill['total'] ? 'paid' : 'partial');
        Database::execute(
            'UPDATE vendor_bills SET payment_status = ?, updated_at = NOW() WHERE bill_id = ? AND tenant_id = ?',
            [$status, $billId, Database::tenantId()]
        );
    }

    public static function raw(int $id): ?array
    {
        return Database::fetch('SELECT * FROM vendor_bills WHERE bill_id = ? AND tenant_id = ? LIMIT 1', [$id, Database::tenantId()]);
    }

    public static function items(int $id): array
    {
        return Database::fetchAll(
            'SELECT vbi.*, p.product_name
             FROM vendor_bill_items vbi
             LEFT JOIN products p ON p.product_id = vbi.product_id AND p.tenant_id = vbi.tenant_id
             WHERE vbi.bill_id = ? AND vbi.tenant_id = ?
             ORDER BY vbi.sort_order ASC, vbi.item_id ASC',
            [$id, Database::tenantId()]
        );
    }

    public static function grnIds(int $billId): array
    {
        $rows = Database::fetchAll('SELECT grn_id FROM vendor_bill_grns WHERE bill_id = ? AND tenant_id = ?', [$billId, Database::tenantId()]);
        return array_map(fn(array $r): int => (int)$r['grn_id'], $rows);
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
            'total' => round($subtotal + $tax + $otherCharges, 2),
        ];
    }

    public static function formatSummary(array $row): array
    {
        return [
            'bill_id' => (int)$row['bill_id'],
            'id' => (string)$row['bill_id'],
            'bill_number' => $row['bill_number'],
            'vendor_invoice_number' => $row['vendor_invoice_number'],
            'vendor_id' => (int)$row['vendor_id'],
            'vendor_name' => $row['vendor_name'] ?? null,
            'vendor_code' => $row['vendor_code'] ?? null,
            'po_id' => $row['po_id'] ? (int)$row['po_id'] : null,
            'po_number' => $row['po_number'] ?? null,
            'bill_date' => $row['bill_date'],
            'due_date' => $row['due_date'],
            'subtotal' => (float)$row['subtotal'],
            'tax_amount' => (float)$row['tax_amount'],
            'other_charges' => (float)$row['other_charges'],
            'total' => (float)$row['total'],
            'amount_paid' => (float)$row['amount_paid'],
            'balance_due' => max(0, round((float)$row['total'] - (float)$row['amount_paid'], 2)),
            'status' => $row['status'],
            'payment_status' => $row['payment_status'],
            'notes' => $row['notes'],
            'expense_id' => $row['expense_id'] ? (int)$row['expense_id'] : null,
            'created_by' => $row['created_by'] ? (int)$row['created_by'] : null,
            'approved_by' => $row['approved_by'] ? (int)$row['approved_by'] : null,
            'approved_at' => $row['approved_at'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    public static function formatDetail(array $row): array
    {
        $formatted = self::formatSummary($row);
        $formatted['items'] = array_map(function (array $item): array {
            return [
                'item_id' => (int)$item['item_id'],
                'bill_id' => (int)$item['bill_id'],
                'po_item_id' => $item['po_item_id'] ? (int)$item['po_item_id'] : null,
                'description' => $item['description'],
                'product_id' => $item['product_id'] ? (int)$item['product_id'] : null,
                'product_name' => $item['product_name'] ?? null,
                'quantity' => (float)$item['quantity'],
                'unit' => $item['unit'],
                'unit_price' => (float)$item['unit_price'],
                'gst_rate' => (float)$item['gst_rate'],
                'line_total' => (float)$item['line_total'],
                'sort_order' => (int)$item['sort_order'],
            ];
        }, $row['items'] ?? []);
        $formatted['grn_ids'] = $row['grn_ids'] ?? [];

        return $formatted;
    }

    private static function replaceItems(int $id, array $items): void
    {
        Database::execute('DELETE FROM vendor_bill_items WHERE bill_id = ? AND tenant_id = ?', [$id, Database::tenantId()]);
        foreach ($items as $index => $item) {
            $lineTotal = round((float)$item['quantity'] * (float)$item['unit_price'], 2);
            Database::insertTenant('vendor_bill_items', [
                'bill_id'      => $id,
                'po_item_id'   => $item['po_item_id'] ?? null,
                'description'  => $item['description'],
                'product_id'   => $item['product_id'] ?: null,
                'quantity'     => $item['quantity'],
                'unit'         => $item['unit'],
                'unit_price'   => $item['unit_price'],
                'gst_rate'     => $item['gst_rate'],
                'line_total'   => $lineTotal,
                'sort_order'   => $item['sort_order'] ?? $index,
            ]);
        }
    }
}
