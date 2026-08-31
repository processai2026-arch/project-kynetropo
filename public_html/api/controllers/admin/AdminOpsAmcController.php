<?php
declare(strict_types=1);

/**
 * Ops AMC Controller
 * GET    /admin/ops/amc               — list
 * POST   /admin/ops/amc               — create
 * PUT    /admin/ops/amc/{id}          — update (mark paid etc.)
 * DELETE /admin/ops/amc/{id}
 */
class AdminOpsAmcController
{
    public function index(Request $request): void
    {
        $tenantId = Database::tenantId();
        $status   = $request->query('status');
        $today    = date('Y-m-d');

        $sql    = "SELECT a.*, c.name AS client_name, p.name AS project_name,
                          DATEDIFF(a.renewal_date, CURDATE()) AS days_until_renewal
                   FROM ops_amc_records a
                   JOIN ops_clients  c ON c.id = a.client_id  AND c.tenant_id = a.tenant_id
                   JOIN ops_projects p ON p.id = a.project_id AND p.tenant_id = a.tenant_id
                   WHERE a.tenant_id = ?";
        $params = [$tenantId];

        if ($status) { $sql .= ' AND a.status = ?'; $params[] = $status; }
        $sql .= ' ORDER BY a.renewal_date ASC';

        $rows = Database::fetchAll($sql, $params);

        // Auto-update statuses
        foreach ($rows as &$row) {
            $computed = $this->computeStatus($row['renewal_date'], $today, $row['status']);
            if ($computed !== $row['status']) {
                Database::update('ops_amc_records', ['status' => $computed], ['id' => $row['id']]);
                $row['status'] = $computed;
            }
        }
        unset($row);

        Response::success(array_map([$this, 'format'], $rows));
    }

    public function store(Request $request): void
    {
        $body      = $request->body();
        $tenantId  = Database::tenantId();
        $clientId  = (int)($body['client_id']  ?? 0);
        $projectId = (int)($body['project_id'] ?? 0);
        $amount    = (float)($body['amount']   ?? 0);

        if (!$clientId)  Response::error('Client is required', 422);
        if (!$projectId) Response::error('Project is required', 422);
        if ($amount <= 0) Response::error('Amount required', 422);

        $startDate   = $body['start_date'] ?? date('Y-m-d');
        $renewalDate = $body['renewal_date'] ?? date('Y-m-d', strtotime($startDate . ' +1 year'));

        $id = Database::insert('ops_amc_records', [
            'tenant_id'    => $tenantId,
            'client_id'    => $clientId,
            'project_id'   => $projectId,
            'amount'       => $amount,
            'start_date'   => $startDate,
            'renewal_date' => $renewalDate,
            'status'       => 'active',
            'payment_mode' => trim((string)($body['payment_mode'] ?? '')),
            'notes'        => trim((string)($body['notes'] ?? '')),
        ]);

        $row = Database::fetch(
            "SELECT a.*, c.name AS client_name, p.name AS project_name,
                    DATEDIFF(a.renewal_date, CURDATE()) AS days_until_renewal
             FROM ops_amc_records a
             JOIN ops_clients c ON c.id = a.client_id
             JOIN ops_projects p ON p.id = a.project_id
             WHERE a.id = ? LIMIT 1",
            [$id]
        );
        Response::success($this->format($row), 'Created', 201);
    }

    public function update(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $amc = Database::fetch(
            'SELECT * FROM ops_amc_records WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        );
        if (!$amc) Response::error('AMC record not found', 404);

        $updates = [];
        foreach (['payment_mode','notes'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        foreach (['start_date','renewal_date'] as $f) {
            if (!empty($body[$f])) $updates[$f] = $body[$f];
        }
        if (isset($body['amount'])) $updates['amount'] = (float)$body['amount'];
        if (isset($body['status']) && in_array($body['status'], ['active','due','overdue','paid'])) {
            $updates['status'] = $body['status'];

            // If marking paid → create a payment record and log expense
            if ($body['status'] === 'paid' && $amc['status'] !== 'paid') {
                $payId = Database::insert('ops_payments', [
                    'tenant_id'    => $tenantId,
                    'client_id'    => (int)$amc['client_id'],
                    'project_id'   => (int)$amc['project_id'],
                    'amount'       => (float)$amc['amount'],
                    'type'         => 'amc',
                    'mode'         => $body['payment_mode'] ?? 'bank_transfer',
                    'reference'    => 'AMC renewal ' . $amc['renewal_date'],
                    'recorded_by'  => $body['recorded_by'] ?? '',
                    'payment_date' => date('Y-m-d'),
                    'notes'        => 'AMC payment',
                ]);
                $updates['payment_id'] = $payId;

                // Update project balance
                $proj = Database::fetch('SELECT * FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1', [(int)$amc['project_id'], $tenantId]);
                if ($proj) {
                    $nr = (float)$proj['received'] + (float)$amc['amount'];
                    $nb = max(0, (float)$proj['quoted'] - $nr);
                    $ns = $nb <= 0 ? 'paid' : 'partial';
                    Database::update('ops_projects', ['received' => $nr, 'balance' => $nb, 'payment_status' => $ns], ['id' => $proj['id']]);
                }

                Database::insert('ops_activity_log', [
                    'tenant_id'   => $tenantId,
                    'entity_type' => 'client',
                    'entity_id'   => (int)$amc['client_id'],
                    'action'      => 'amc_paid',
                    'description' => 'AMC renewed — ₹' . number_format((float)$amc['amount']),
                    'done_by'     => $body['recorded_by'] ?? '',
                ]);
            }
        }

        if (!empty($updates)) {
            Database::update('ops_amc_records', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        }

        $row = Database::fetch(
            "SELECT a.*, c.name AS client_name, p.name AS project_name,
                    DATEDIFF(a.renewal_date, CURDATE()) AS days_until_renewal
             FROM ops_amc_records a
             JOIN ops_clients c ON c.id = a.client_id
             JOIN ops_projects p ON p.id = a.project_id
             WHERE a.id = ? LIMIT 1",
            [$id]
        );
        Response::success($this->format($row));
    }

    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        Database::fetch('SELECT id FROM ops_amc_records WHERE id = ? AND tenant_id = ?', [$id, $tenantId])
            ?: Response::error('AMC record not found', 404);
        Database::query('DELETE FROM ops_amc_records WHERE id = ? AND tenant_id = ?', [$id, $tenantId]);
        Response::success(['message' => 'Deleted']);
    }

    private function computeStatus(string $renewalDate, string $today, string $current): string
    {
        if ($current === 'paid') return 'paid';
        $days = (int) round((strtotime($renewalDate) - strtotime($today)) / 86400);
        if ($days < 0)   return 'overdue';
        if ($days <= 30) return 'due';
        return 'active';
    }

    private function format(array $row): array
    {
        return [
            'id'                  => (int)$row['id'],
            'client_id'           => (int)$row['client_id'],
            'client_name'         => $row['client_name'] ?? null,
            'project_id'          => (int)$row['project_id'],
            'project_name'        => $row['project_name'] ?? null,
            'amount'              => (float)$row['amount'],
            'start_date'          => $row['start_date'],
            'renewal_date'        => $row['renewal_date'],
            'status'              => $row['status'],
            'payment_mode'        => $row['payment_mode'],
            'notes'               => $row['notes'],
            'days_until_renewal'  => isset($row['days_until_renewal']) ? (int)$row['days_until_renewal'] : null,
        ];
    }
}
