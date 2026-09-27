<?php
declare(strict_types=1);

/**
 * Ops AMC Controller
 * GET    /admin/ops/amc               — list (?status=, ?project_id=)
 * POST   /admin/ops/amc               — create
 * PUT    /admin/ops/amc/{id}          — edit amount, dates, notes
 * POST   /admin/ops/amc/{id}/collect  — record this year's AMC payment
 * DELETE /admin/ops/amc/{id}
 *
 * An AMC record is one contract, tracked a year at a time: start_date to
 * renewal_date is the current year. term_paid says whether that year is paid
 * for (or is the free first year). The next payment is due on renewal_date
 * when it is, and straight away (from start_date) when it is not.
 *
 * AMC is separate from the project price: its payments show in Finance as
 * type "amc" and never change the project's received amount or balance.
 */
class AdminOpsAmcController
{
    private const MODES = ['cash', 'bank_transfer', 'upi', 'cheque', 'other'];

    private const SELECT = "SELECT a.*, c.name AS client_name, c.company AS client_company, p.name AS project_name,
                                   p.project_code,
                                   IF(a.term_paid, a.renewal_date, a.start_date) AS due_date,
                                   DATEDIFF(IF(a.term_paid, a.renewal_date, a.start_date), CURDATE()) AS days_until_due
                              FROM ops_amc_records a
                              JOIN ops_clients  c ON c.id = a.client_id  AND c.tenant_id = a.tenant_id
                              JOIN ops_projects p ON p.id = a.project_id AND p.tenant_id = a.tenant_id";

    public function index(Request $request): void
    {
        $tenantId  = Database::tenantId();
        $status    = $request->query('status');
        $projectId = (int)$request->query('project_id', 0);

        $sql    = self::SELECT . ' WHERE a.tenant_id = ?';
        $params = [$tenantId];
        if ($projectId) { $sql .= ' AND a.project_id = ?'; $params[] = $projectId; }
        $sql .= ' ORDER BY due_date ASC, a.id ASC';

        $rows = Database::fetchAll($sql, $params);

        // Keep the stored status in step with the due date (reports read it).
        foreach ($rows as &$row) {
            $computed = self::statusFor((string)$row['due_date']);
            if ($computed !== $row['status']) {
                Database::update('ops_amc_records', ['status' => $computed], ['id' => $row['id']]);
                $row['status'] = $computed;
            }
        }
        unset($row);

        if ($status) $rows = array_values(array_filter($rows, fn($r) => $r['status'] === $status));

        Response::success(array_map([$this, 'format'], $rows));
    }

    /**
     * POST /admin/ops/amc
     *
     * first_year_free = true:  amount is what they pay each year from the
     *                          renewal; nothing is due before renewal_date.
     * first_year_free = false: amount is charged for the first year too;
     *                          first_year_paid says whether it has been paid.
     *                          When it has, the payment is recorded in Finance.
     * renewal_date defaults to a year after start_date.
     */
    public function store(Request $request): void
    {
        $body      = $request->body();
        $tenantId  = Database::tenantId();
        $clientId  = (int)($body['client_id']  ?? 0);
        $projectId = (int)($body['project_id'] ?? 0);
        $amount    = (float)($body['amount']   ?? 0);
        $free      = !empty($body['first_year_free']);
        $paid      = !$free && !empty($body['first_year_paid']);

        if (!$projectId) Response::error('Project is required', 422);
        $project = Database::fetch('SELECT id, client_id, name FROM ops_projects WHERE id = ? AND tenant_id = ? LIMIT 1', [$projectId, $tenantId]);
        if (!$project) Response::error('Project not found', 404);
        if ($clientId && $clientId !== (int)$project['client_id']) Response::error('That project belongs to another client', 422);
        $clientId = (int)$project['client_id'];
        if ($amount <= 0) Response::error($free ? 'Enter what they pay each year from the renewal' : 'AMC amount is required', 422);

        $startDate   = self::date($body['start_date'] ?? null) ?? date('Y-m-d');
        $renewalDate = self::date($body['renewal_date'] ?? null) ?? self::yearAfter($startDate);
        if ($renewalDate <= $startDate) Response::error('Renewal date must be after the start date', 422);

        $mode = in_array($body['payment_mode'] ?? '', self::MODES, true) ? $body['payment_mode'] : 'bank_transfer';

        Database::beginTransaction();
        try {
            $id = Database::insert('ops_amc_records', [
                'tenant_id'       => $tenantId,
                'client_id'       => $clientId,
                'project_id'      => $projectId,
                'amount'          => $amount,
                'first_year_free' => $free ? 1 : 0,
                'term_paid'       => ($free || $paid) ? 1 : 0,
                'start_date'      => $startDate,
                'renewal_date'    => $renewalDate,
                'status'          => self::statusFor(($free || $paid) ? $renewalDate : $startDate),
                'payment_mode'    => $paid ? $mode : null,
                'notes'           => trim((string)($body['notes'] ?? '')),
            ]);

            if ($paid) {
                $payId = $this->recordPayment($tenantId, $clientId, $projectId, $amount, $mode,
                    self::date($body['payment_date'] ?? null) ?? date('Y-m-d'), $startDate, $renewalDate,
                    (string)($body['reference'] ?? ''), (string)($body['recorded_by'] ?? ''));
                Database::update('ops_amc_records', ['payment_id' => $payId], ['id' => $id]);
            }

            $what = $free ? 'first year free, ₹' . number_format($amount) . ' a year from ' . self::human($renewalDate)
                  : ($paid ? '₹' . number_format($amount) . ' a year, first year paid'
                           : '₹' . number_format($amount) . ' a year, first year not paid yet');
            $this->log($tenantId, $clientId, 'amc_added', 'AMC added for ' . $project['name'] . ' — ' . $what, (string)($body['recorded_by'] ?? ''));

            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }

        Response::success($this->format($this->find($id, $tenantId)), 'Created', 201);
    }

    /** PUT /admin/ops/amc/{id} — amount, dates, notes. Payments go through collect. */
    public function update(Request $request): void
    {
        // Older pages marked an AMC paid through here.
        if (($request->body()['status'] ?? null) === 'paid') { $this->collect($request); }

        $id       = (int) $request->param('id');
        $tenantId = Database::tenantId();
        $body     = $request->body();

        $amc = Database::fetch('SELECT * FROM ops_amc_records WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId]);
        if (!$amc) Response::error('AMC record not found', 404);

        $updates = [];
        foreach (['payment_mode', 'notes'] as $f) {
            if (isset($body[$f])) $updates[$f] = trim((string)$body[$f]);
        }
        if (isset($body['amount'])) {
            if ((float)$body['amount'] <= 0) Response::error('AMC amount is required', 422);
            $updates['amount'] = (float)$body['amount'];
        }
        $start   = self::date($body['start_date'] ?? null) ?? (string)$amc['start_date'];
        $renewal = self::date($body['renewal_date'] ?? null) ?? (string)$amc['renewal_date'];
        if ($renewal <= $start) Response::error('Renewal date must be after the start date', 422);
        $updates['start_date']   = $start;
        $updates['renewal_date'] = $renewal;
        $updates['status']       = self::statusFor((int)$amc['term_paid'] ? $renewal : $start);

        Database::update('ops_amc_records', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        Response::success($this->format($this->find($id, $tenantId)));
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

        $amc = Database::fetch('SELECT * FROM ops_amc_records WHERE id = ? AND tenant_id = ? LIMIT 1', [$id, $tenantId]);
        if (!$amc) Response::error('AMC record not found', 404);

        $renewing = (int)$amc['term_paid'] === 1;
        $start    = $renewing ? (string)$amc['renewal_date'] : (string)$amc['start_date'];
        $renewal  = $renewing ? self::yearAfter($start) : (string)$amc['renewal_date'];
        $amount   = isset($body['amount']) && (float)$body['amount'] > 0 ? (float)$body['amount'] : (float)$amc['amount'];
        $mode     = in_array($body['payment_mode'] ?? '', self::MODES, true) ? $body['payment_mode'] : 'bank_transfer';
        $by       = (string)($body['recorded_by'] ?? '');

        Database::beginTransaction();
        try {
            $payId = $this->recordPayment($tenantId, (int)$amc['client_id'], (int)$amc['project_id'], $amount, $mode,
                self::date($body['payment_date'] ?? null) ?? date('Y-m-d'), $start, $renewal, (string)($body['reference'] ?? ''), $by);

            Database::update('ops_amc_records', [
                'start_date'   => $start,
                'renewal_date' => $renewal,
                'term_paid'    => 1,
                'payment_id'   => $payId,
                'payment_mode' => $mode,
                'status'       => self::statusFor($renewal),
            ], ['id' => $id, 'tenant_id' => $tenantId]);

            $this->log($tenantId, (int)$amc['client_id'], 'amc_paid',
                'AMC ' . ($renewing ? 'renewed' : 'paid') . ' — ₹' . number_format($amount) . ' for ' . self::human($start) . ' to ' . self::human($renewal), $by);

            Database::commit();
        } catch (\Throwable $e) {
            Database::rollBack();
            throw $e;
        }

        Response::success($this->format($this->find($id, $tenantId)), 'Collected');
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
            'status'     => self::statusFor((string)$amc['start_date']),
        ], ['id' => $amc['id'], 'tenant_id' => $tenantId]);
    }

    /** overdue once the due date has passed, due within 30 days, active before that. */
    public static function statusFor(string $dueDate): string
    {
        $days = (int) round((strtotime($dueDate) - strtotime(date('Y-m-d'))) / 86400);
        if ($days < 0)   return 'overdue';
        if ($days <= 30) return 'due';
        return 'active';
    }

    private function recordPayment(int $tenantId, int $clientId, int $projectId, float $amount, string $mode,
                                   string $paidOn, string $from, string $to, string $reference, string $by): int
    {
        return Database::insert('ops_payments', [
            'tenant_id'    => $tenantId,
            'client_id'    => $clientId,
            'project_id'   => $projectId,
            'amount'       => $amount,
            'type'         => 'amc',
            'mode'         => $mode,
            'reference'    => trim($reference) !== '' ? trim($reference) : 'AMC ' . $from . ' to ' . $to,
            'recorded_by'  => $by,
            'payment_date' => $paidOn,
            'notes'        => 'AMC payment',
        ]);
    }

    private function log(int $tenantId, int $clientId, string $action, string $description, string $by): void
    {
        Database::insert('ops_activity_log', [
            'tenant_id'   => $tenantId,
            'entity_type' => 'client',
            'entity_id'   => $clientId,
            'action'      => $action,
            'description' => $description,
            'done_by'     => $by,
        ]);
    }

    private function find(int $id, int $tenantId): array
    {
        return Database::fetch(self::SELECT . ' WHERE a.id = ? AND a.tenant_id = ? LIMIT 1', [$id, $tenantId]) ?: [];
    }

    private static function date(mixed $value): ?string
    {
        $value = trim((string)$value);
        $d = \DateTime::createFromFormat('!Y-m-d', $value);
        return $d && $d->format('Y-m-d') === $value ? $value : null;
    }

    private static function yearAfter(string $date): string
    {
        return date('Y-m-d', strtotime($date . ' +1 year'));
    }

    private static function human(string $date): string
    {
        return date('j M Y', strtotime($date));
    }

    private function format(array $row): array
    {
        return [
            'id'              => (int)$row['id'],
            'client_id'       => (int)$row['client_id'],
            'client_name'     => $row['client_name'] ?? null,
            'client_company'  => $row['client_company'] ?? '',
            'project_id'      => (int)$row['project_id'],
            'project_name'    => $row['project_name'] ?? null,
            'project_code'    => $row['project_code'] ?? null,
            'amount'          => (float)$row['amount'],
            'first_year_free' => (int)($row['first_year_free'] ?? 0) === 1,
            'term_paid'       => (int)($row['term_paid'] ?? 1) === 1,
            // Still in the free first year: free, and no AMC payment made yet.
            'in_free_year'    => (int)($row['first_year_free'] ?? 0) === 1 && (int)($row['term_paid'] ?? 1) === 1 && empty($row['payment_id']),
            'start_date'      => $row['start_date'],
            'renewal_date'    => $row['renewal_date'],
            'due_date'        => $row['due_date'] ?? $row['renewal_date'],
            'days_until_due'  => isset($row['days_until_due']) ? (int)$row['days_until_due'] : null,
            'status'          => $row['status'],
            'payment_mode'    => $row['payment_mode'],
            'notes'           => $row['notes'],
        ];
    }
}
