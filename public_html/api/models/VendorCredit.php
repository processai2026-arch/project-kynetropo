<?php
declare(strict_types=1);

/**
 * Vendor Credit — a credit note received from a supplier (against a vendor bill
 * or standalone) that reduces the amount payable to that vendor. Tenant-scoped.
 */
class VendorCredit
{
    public const STATUSES = ['draft', 'applied', 'void'];

    public static function all(array $filters, int $page, int $limit): array
    {
        $page = max(1, $page);
        $limit = min(100, max(1, $limit));
        $where = ['vc.tenant_id = ?'];
        $params = [Database::tenantId()];

        if (!empty($filters['status']) && in_array($filters['status'], self::STATUSES, true)) {
            $where[] = 'vc.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['vendor_id'])) {
            $where[] = 'vc.vendor_id = ?';
            $params[] = (int)$filters['vendor_id'];
        }

        $whereClause = implode(' AND ', $where);
        $total = Database::count("SELECT COUNT(*) AS cnt FROM vendor_credits vc WHERE $whereClause", $params);
        $rows = Database::fetchAll(
            "SELECT vc.*, v.name AS vendor_name, v.vendor_code, vb.bill_number
             FROM vendor_credits vc
             JOIN vendors v ON v.vendor_id = vc.vendor_id AND v.tenant_id = vc.tenant_id
             LEFT JOIN vendor_bills vb ON vb.bill_id = vc.vendor_bill_id AND vb.tenant_id = vc.tenant_id
             WHERE $whereClause
             ORDER BY vc.created_at DESC, vc.credit_id DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, ($page - 1) * $limit]
        );
        foreach ($rows as &$r) { $r['amount'] = (float)$r['amount']; }

        return [
            'rows' => $rows,
            'pagination' => [
                'page' => $page, 'limit' => $limit, 'total' => $total,
                'total_pages' => (int)ceil($total / max(1, $limit)),
            ],
        ];
    }

    public static function findById(int $id): ?array
    {
        $row = Database::fetch(
            "SELECT vc.*, v.name AS vendor_name, vb.bill_number
             FROM vendor_credits vc
             JOIN vendors v ON v.vendor_id = vc.vendor_id AND v.tenant_id = vc.tenant_id
             LEFT JOIN vendor_bills vb ON vb.bill_id = vc.vendor_bill_id AND vb.tenant_id = vc.tenant_id
             WHERE vc.credit_id = ? AND vc.tenant_id = ? LIMIT 1",
            [$id, Database::tenantId()]
        );
        if ($row) { $row['amount'] = (float)$row['amount']; }
        return $row ?: null;
    }

    /** Sum of applied credits outstanding against a vendor (reduces payable). */
    public static function outstandingForVendor(int $vendorId): float
    {
        $row = Database::fetch(
            "SELECT COALESCE(SUM(amount),0) AS total FROM vendor_credits
             WHERE tenant_id = ? AND vendor_id = ? AND status = 'applied'",
            [Database::tenantId(), $vendorId]
        );
        return (float)($row['total'] ?? 0);
    }

    public static function create(array $data): int
    {
        return Database::insertTenant('vendor_credits', [
            'vendor_id'      => (int)$data['vendor_id'],
            'vendor_bill_id' => !empty($data['vendor_bill_id']) ? (int)$data['vendor_bill_id'] : null,
            'credit_number'  => $data['credit_number'],
            'credit_date'    => $data['credit_date'],
            'reason'         => $data['reason'] ?? null,
            'amount'         => (float)$data['amount'],
            'status'         => 'draft',
            'notes'          => $data['notes'] ?? null,
            'created_by'     => $data['created_by'] ?? null,
        ]);
    }

    public static function setStatus(int $id, string $status): void
    {
        Database::execute(
            'UPDATE vendor_credits SET status = ? WHERE credit_id = ? AND tenant_id = ?',
            [$status, $id, Database::tenantId()]
        );
    }

    public static function nextNumber(): string
    {
        $row = Database::fetch(
            "SELECT credit_number FROM vendor_credits WHERE tenant_id = ?
             ORDER BY credit_id DESC LIMIT 1",
            [Database::tenantId()]
        );
        $seq = 1;
        if ($row && preg_match('/(\d+)$/', (string)$row['credit_number'], $m)) {
            $seq = (int)$m[1] + 1;
        }
        return 'VC-' . date('Y') . '-' . str_pad((string)$seq, 4, '0', STR_PAD_LEFT);
    }
}
