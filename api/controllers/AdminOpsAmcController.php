<?php
declare(strict_types=1);

/**
 * Ops AMC Controller — the rules live in OpsAmc.
 * GET    /admin/ops/amc               — list (?status=, ?project_id=)
 * POST   /admin/ops/amc               — create
 * PUT    /admin/ops/amc/{id}          — edit anything: plan, price, dates, first year paid or not
 * POST   /admin/ops/amc/{id}/collect  — record this year's AMC payment
 * DELETE /admin/ops/amc/{id}
 */
class AdminOpsAmcController
{
    public function index(Request $request): void
    {
        $tenantId  = Database::tenantId();
        $status    = $request->query('status');
        $projectId = (int)$request->query('project_id', 0);

        $sql    = OpsAmc::SELECT . ' WHERE a.tenant_id = ?';
        $params = [$tenantId];
        if ($projectId) { $sql .= ' AND a.project_id = ?'; $params[] = $projectId; }
        $sql .= ' ORDER BY due_date ASC, a.id ASC';

        $rows = Database::fetchAll($sql, $params);

        // Keep the stored status in step with the due date (reports read it).
        foreach ($rows as &$row) {
            $computed = OpsAmc::statusFor((string)$row['due_date']);
            if ($computed !== $row['status']) {
                Database::update('ops_amc_records', ['status' => $computed], ['id' => $row['id']]);
                $row['status'] = $computed;
            }
        }
        unset($row);

        if ($status) $rows = array_values(array_filter($rows, fn($r) => $r['status'] === $status));

        Response::success(array_map([OpsAmc::class, 'format'], $rows));
    }

    /** POST /admin/ops/amc — see OpsAmc::normalise for the fields. */
    public function store(Request $request): void
    {
        $body     = $request->body();
        $tenantId = Database::tenantId();

        $projectId = (int)($body['project_id'] ?? 0);
        if (!$projectId) Response::error('Project is required', 422);
        $project = Database::fetch('SELECT id, client_id, name FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1', [$projectId, $tenantId]);
        if (!$project) Response::error('Project not found', 404);
        if (!empty($body['client_id']) && (int)$body['client_id'] !== (int)$project['client_id']) Response::error('That project belongs to another client', 422);

        $amc = OpsAmc::normalise($body);
        if ($amc['plan'] === 'none') Response::error('Choose AMC from the 2nd year or from the 1st year', 422);

        $id = $this->inTransaction(fn() => OpsAmc::create($tenantId, $project, $amc, (string)($body['recorded_by'] ?? '')));
        Response::success(OpsAmc::format(OpsAmc::find($id, $tenantId)), 'Created', 201);
    }

    /** PUT /admin/ops/amc/{id} — any field; the first year's Finance payment follows. */
    public function update(Request $request): void
    {
        // Older pages marked an AMC paid through here.
        if (($request->body()['status'] ?? null) === 'paid') { $this->collect($request); }

        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $current = OpsAmc::find($id, $tenantId) ?? Response::error('AMC record not found', 404);
        $amc     = OpsAmc::normalise($body, $current);
        if ($amc['plan'] === 'none') {
            $this->inTransaction(fn() => OpsAmc::remove($tenantId, $current, (string)($body['recorded_by'] ?? '')));
            Response::success(['message' => 'Deleted']);
        }

        $this->inTransaction(fn() => OpsAmc::update($tenantId, $current, $amc, (string)($body['recorded_by'] ?? '')));
        Response::success(OpsAmc::format(OpsAmc::find($id, $tenantId)));
    }

    /**
     * POST /admin/ops/amc/{id}/collect
     *
     * Records the AMC payment in Finance. If the current year was not paid yet
     * (a charged first year), this pays it. If it was, this is the renewal: the
     * next year starts on the old renewal date and renews a year after that.
     */
    public function collect(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $current = OpsAmc::find($id, $tenantId) ?? Response::error('AMC record not found', 404);
        $amount  = isset($body['amount']) && (float)$body['amount'] > 0 ? (float)$body['amount'] : (float)$current['amount'];
        $mode    = in_array($body['payment_mode'] ?? '', OpsAmc::MODES, true) ? $body['payment_mode'] : 'bank_transfer';

        $this->inTransaction(fn() => OpsAmc::collect($tenantId, $current, $amount, $mode,
            OpsAmc::date($body['payment_date'] ?? null) ?? date('Y-m-d'), (string)($body['reference'] ?? ''), (string)($body['recorded_by'] ?? '')));

        Response::success(OpsAmc::format(OpsAmc::find($id, $tenantId)), 'Collected');
    }

    /** DELETE /admin/ops/amc/{id} — a first-year payment it recorded goes with it. */
    public function destroy(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $current  = OpsAmc::find($id, $tenantId) ?? Response::error('AMC record not found', 404);
        $this->inTransaction(fn() => OpsAmc::remove($tenantId, $current, (string)$request->query('by', '')));
        Response::success(['message' => 'Deleted']);
    }

    /**
     * A Finance payment of $paymentId was deleted: if it paid an AMC's current
     * year, that year is unpaid again, so the amount is due from its start.
     */
    public static function paymentRemoved(int $tenantId, int $paymentId): void
    {
        $amc = Database::fetch('SELECT * FROM ops_amc_records WHERE payment_id = ? AND tenant_id = ? LIMIT 1', [$paymentId, $tenantId]);
        if (!$amc) return;
        Database::update('ops_amc_records', [
            'term_paid'  => 0,
            'payment_id' => null,
            'status'     => OpsAmc::statusFor((string)$amc['start_date']),
        ], ['id' => $amc['id'], 'tenant_id' => $tenantId]);
    }

    private function inTransaction(callable $work): mixed
    {
        Database::beginTransaction();
        try {
            $result = $work();
            Database::commit();
            return $result;
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }
    }
}
