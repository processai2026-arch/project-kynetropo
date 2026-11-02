<?php
declare(strict_types=1);

/**
 * Ops AMC Controller — the rules live in OpsAmc.
 * GET    /admin/ops/amc               — list (?status=, ?project_id=)
 * POST   /admin/ops/amc               — create
 * PUT    /admin/ops/amc/{id}          — edit anything: plan, price, dates, first year paid or not
 * GET    /admin/ops/amc/{id}          — one AMC with each year's payment
 * POST   /admin/ops/amc/{id}/collect  — record this year's AMC payment
 * POST   /admin/ops/amc/{id}/revert   — undo the latest collection
 * PUT    /admin/ops/amc/{id}/usage    — users now per category, storage used: the price follows
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

    /** GET /admin/ops/amc/{id} — the AMC, and every payment it has had. */
    public function show(Request $request): void
    {
        $tenantId = Database::tenantId();
        $row = OpsAmc::find((int)$request->param('id'), $tenantId) ?? Response::error('AMC record not found', 404);
        $computed = OpsAmc::statusFor((string)$row['due_date']);
        if ($computed !== $row['status']) {
            Database::update('ops_amc_records', ['status' => $computed], ['id' => $row['id']]);
            $row['status'] = $computed;
        }
        $data = OpsAmc::format($row);
        $data['payments'] = OpsAmc::history($tenantId, $row);
        Response::success($data);
    }

    /** POST /admin/ops/amc/{id}/revert — the latest collection's payment goes, and the AMC goes back. */
    public function revert(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $current  = OpsAmc::find($id, $tenantId) ?? Response::error('AMC record not found', 404);
        try {
            $now = $this->inTransaction(fn() => OpsAmc::revert($tenantId, $current, (string)($request->body()['recorded_by'] ?? '')));
        } catch (AppException $e) {
            Response::error($e->getMessage(), $e->getCode());
        }
        Response::success(OpsAmc::format(OpsAmc::find($id, $tenantId)), 'Reverted — back to ' . $now);
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
            $this->inTransaction(function () use ($tenantId, $current, $amc, $body) {
                OpsAmc::remove($tenantId, $current, (string)($body['recorded_by'] ?? ''));
                OpsAmc::setReason($tenantId, (int)$current['project_id'], $amc['reason']);
            });
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

    /**
     * PUT /admin/ops/amc/{id}/usage — { users: {"ERP": 7, …}, storage_used_gb }
     *
     * The users or storage in use changed. The yearly price is worked out again,
     * so Finance, the dashboard's AMC due and the renewals show the new amount;
     * payments already recorded are left as they were.
     */
    public function usage(Request $request): void
    {
        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();
        $current  = OpsAmc::find($id, $tenantId) ?? Response::error('AMC record not found', 404);
        $usage    = ['users' => is_array($body['users'] ?? null) ? $body['users'] : []];
        if (array_key_exists('storage_used_gb', $body)) $usage['storage_used_gb'] = $body['storage_used_gb'];

        $this->inTransaction(fn() => OpsAmc::updateUsage($tenantId, $current, $usage, (string)($body['recorded_by'] ?? '')));
        Response::success(OpsAmc::format(OpsAmc::find($id, $tenantId)), 'Usage updated');
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
     * A Finance payment of $paymentId is being deleted: if it is an AMC's
     * current payment, the AMC goes back to how it was before it was
     * collected (or, for an older payment, that year is unpaid again).
     */
    public static function paymentRemoved(int $tenantId, int $paymentId, string $by = ''): void
    {
        $amc = Database::fetch('SELECT * FROM ops_amc_records WHERE payment_id = ? AND tenant_id = ? LIMIT 1', [$paymentId, $tenantId]);
        $payment = Database::fetch('SELECT * FROM ops_payments WHERE id = ? AND tenant_id = ? LIMIT 1', [$paymentId, $tenantId]);
        if (!$amc || !$payment) return;
        OpsAmc::restoreBefore($tenantId, $amc, $payment, $by);
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
