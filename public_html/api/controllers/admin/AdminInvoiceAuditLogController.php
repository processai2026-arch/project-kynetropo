<?php
declare(strict_types=1);

/**
 * Admin Invoice Audit Log Controller
 * GET /admin/invoice-audit-log — paginated log scoped to invoice actions
 */
class AdminInvoiceAuditLogController
{
    public function index(Request $request): void
    {
        $page   = max(1, (int)$request->query('page', 1));
        $limit  = min(500, max(1, (int)$request->query('limit', 500)));
        $tid    = Database::tenantId();

        $where  = ['al.tenant_id = ?'];
        $params = [$tid];

        if ($from = $request->query('from_date')) { $where[] = 'DATE(al.created_at) >= ?'; $params[] = $from; }
        if ($to   = $request->query('to_date'))   { $where[] = 'DATE(al.created_at) <= ?'; $params[] = $to; }
        if ($act  = $request->query('action'))    { $where[] = 'al.action LIKE ?'; $params[] = '%' . $act . '%'; }

        $wc     = implode(' AND ', $where);
        $total  = Database::count("SELECT COUNT(*) AS cnt FROM audit_log al WHERE $wc", $params);
        $offset = ($page - 1) * $limit;

        $rows = Database::fetchAll(
            "SELECT al.id AS id, al.action, al.table_name AS entity_type, al.record_id AS entity_id,
                    al.new_value AS new_values, al.ip_address, al.created_at,
                    u.name AS user_name
             FROM audit_log al
             LEFT JOIN users u ON u.user_id = al.user_id AND u.tenant_id = al.tenant_id
             WHERE $wc
             ORDER BY al.created_at DESC
             LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );
        foreach ($rows as &$r) {
            if ($r['new_values']) {
                $decoded = json_decode((string)$r['new_values'], true);
                $r['new_values'] = is_array($decoded) ? $decoded : null;
            }
        }
        Response::paginated($rows, [
            'page'        => $page,
            'limit'       => $limit,
            'total'       => $total,
            'total_pages' => (int)ceil($total / max($limit, 1)),
        ]);
    }
}
