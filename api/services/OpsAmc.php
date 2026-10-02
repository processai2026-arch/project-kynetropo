<?php
declare(strict_types=1);

/**
 * AMC rules, shared by the AMC page and the project form.
 *
 * An AMC record is one contract, tracked a year at a time: start_date to
 * renewal_date is the current year, and contract_start is when the contract
 * began. term_paid says whether the current year is paid for (or is the free
 * first year). The next payment is due on renewal_date when it is, and from
 * start_date when it is not.
 *
 * The plan is asked as one of three:
 *   second_year  AMC from the 2nd year: the first year is free.
 *   first_year   AMC from the 1st year: charged from the start; paid or not.
 *   none         No AMC.
 *
 * The first-year answers stay editable until the contract renews. Paying,
 * unpaying or repricing a first year changes its AMC payment in Finance to
 * match, so Finance always shows what the AMC says. AMC payments never touch
 * a project's received amount or balance.
 */
final class OpsAmc
{
    public const MODES = ['cash', 'bank_transfer', 'upi', 'cheque', 'other'];
    public const PLANS = ['second_year', 'first_year', 'none'];

    public const SELECT = "SELECT a.*, c.name AS client_name, c.company AS client_company, p.name AS project_name,
                                  p.project_code, pay.payment_date AS paid_on,
                                  IF(a.term_paid, a.renewal_date, a.start_date) AS due_date,
                                  DATEDIFF(IF(a.term_paid, a.renewal_date, a.start_date), CURDATE()) AS days_until_due
                             FROM ops_amc_records a
                             JOIN ops_clients  c ON c.id = a.client_id  AND c.tenant_id = a.tenant_id
                             JOIN ops_projects p ON p.id = a.project_id AND p.tenant_id = a.tenant_id
                             LEFT JOIN ops_payments pay ON pay.id = a.payment_id AND pay.tenant_id = a.tenant_id";

    /**
     * Checks an AMC answer and fills in its defaults. Throws a 422 for a bad
     * one, so a form can be checked before anything is saved.
     *
     * $in: plan (or first_year_free), amount, start_date, renewal_date,
     *      first_year_paid, payment_date, payment_mode, notes.
     * $current: the record being edited, for the values left out.
     */
    public static function normalise(array $in, ?array $current = null): array
    {
        $plan = $in['plan'] ?? null;
        if ($plan === null && array_key_exists('first_year_free', $in)) $plan = !empty($in['first_year_free']) ? 'second_year' : 'first_year';
        if ($plan === null && $current) $plan = (int)$current['first_year_free'] === 1 ? 'second_year' : 'first_year';
        if (!in_array($plan, self::PLANS, true)) Response::error('Choose the AMC: from the 2nd year, from the 1st year, or no AMC', 422);
        if ($plan === 'none') return ['plan' => 'none'];

        $amount = isset($in['amount']) && $in['amount'] !== '' ? (float)$in['amount'] : (float)($current['amount'] ?? 0);
        if ($amount <= 0) Response::error('Enter the AMC price per year', 422);

        $start   = self::date($in['start_date'] ?? null) ?? ($current['start_date'] ?? date('Y-m-d'));
        $renewal = self::date($in['renewal_date'] ?? null) ?? ($current && !self::date($in['start_date'] ?? null) ? $current['renewal_date'] : self::yearAfter($start));
        if ($renewal <= $start) Response::error('The AMC renewal date must be after its start date', 422);

        $paid = $plan === 'first_year' && (array_key_exists('first_year_paid', $in)
            ? !empty($in['first_year_paid'])
            : ($current ? (int)$current['first_year_free'] === 0 && (int)$current['term_paid'] === 1 : false));

        return [
            'plan'         => $plan,
            'free'         => $plan === 'second_year',
            'paid'         => $paid,
            'amount'       => $amount,
            'start_date'   => $start,
            'renewal_date' => $renewal,
            'payment_date' => self::date($in['payment_date'] ?? null) ?? ($current['paid_on'] ?? null) ?? date('Y-m-d'),
            'payment_mode' => in_array($in['payment_mode'] ?? '', self::MODES, true) ? $in['payment_mode'] : (($current['payment_mode'] ?? '') ?: 'bank_transfer'),
            'notes'        => array_key_exists('notes', $in) ? trim((string)$in['notes']) : ($current['notes'] ?? ''),
        ];
    }

    /** A new AMC for $project (id, client_id, name). Returns its id. */
    public static function create(int $tenantId, array $project, array $amc, string $by): int
    {
        $id = Database::insert('ops_amc_records', [
            'tenant_id'       => $tenantId,
            'client_id'       => (int)$project['client_id'],
            'project_id'      => (int)$project['id'],
            'amount'          => $amc['amount'],
            'first_year_free' => $amc['free'] ? 1 : 0,
            'term_paid'       => ($amc['free'] || $amc['paid']) ? 1 : 0,
            'contract_start'  => $amc['start_date'],
            'start_date'      => $amc['start_date'],
            'renewal_date'    => $amc['renewal_date'],
            'status'          => self::statusFor(($amc['free'] || $amc['paid']) ? $amc['renewal_date'] : $amc['start_date']),
            'payment_mode'    => $amc['paid'] ? $amc['payment_mode'] : null,
            'notes'           => $amc['notes'],
        ]);
        if ($amc['paid']) {
            $payId = self::insertPayment($tenantId, (int)$project['client_id'], (int)$project['id'], $amc['amount'], $amc['payment_mode'],
                $amc['payment_date'], $amc['start_date'], $amc['renewal_date'], '', $by);
            Database::update('ops_amc_records', ['payment_id' => $payId], ['id' => $id]);
        }
        self::log($tenantId, (int)$project['client_id'], 'amc_added', 'AMC added for ' . $project['name'] . ' — ' . self::describe($amc), $by);
        return $id;
    }

    /**
     * Edit an AMC to match $amc (normalised). Before the contract has renewed,
     * everything can change, and the first year's Finance payment follows:
     * added when it becomes paid, changed with its amount or date, removed
     * when it becomes unpaid or free. After a renewal the past years are
     * history, so only the price, dates and notes change.
     */
    public static function update(int $tenantId, array $current, array $amc, string $by): void
    {
        $id      = (int)$current['id'];
        $renewed = self::renewed($current);
        $updates = ['amount' => $amc['amount'], 'notes' => $amc['notes'], 'renewal_date' => $amc['renewal_date']];

        if ($renewed) {
            $updates['start_date'] = $amc['start_date'];
            $updates['status']     = self::statusFor((int)$current['term_paid'] ? $amc['renewal_date'] : $amc['start_date']);
            Database::update('ops_amc_records', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
            self::log($tenantId, (int)$current['client_id'], 'amc_updated', 'AMC updated — ₹' . number_format($amc['amount']) . ' a year, renews ' . self::human($amc['renewal_date']), $by);
            return;
        }

        $updates += [
            'first_year_free' => $amc['free'] ? 1 : 0,
            'term_paid'       => ($amc['free'] || $amc['paid']) ? 1 : 0,
            'contract_start'  => $amc['start_date'],
            'start_date'      => $amc['start_date'],
            'status'          => self::statusFor(($amc['free'] || $amc['paid']) ? $amc['renewal_date'] : $amc['start_date']),
        ];

        $payId = $current['payment_id'] ? (int)$current['payment_id'] : null;
        $payment = $payId ? Database::fetch('SELECT * FROM ops_payments WHERE id = ? AND tenant_id = ? LIMIT 1', [$payId, $tenantId]) : null;
        if ($amc['paid']) {
            if ($payment) {
                $change = ['amount' => $amc['amount'], 'payment_date' => $amc['payment_date'], 'mode' => $amc['payment_mode']];
                // A reference typed in Finance stays; the generated one follows the dates.
                if ((string)$payment['reference'] === 'AMC ' . $current['start_date'] . ' to ' . $current['renewal_date']) {
                    $change['reference'] = 'AMC ' . $amc['start_date'] . ' to ' . $amc['renewal_date'];
                }
                Database::update('ops_payments', $change, ['id' => $payId, 'tenant_id' => $tenantId]);
            } else {
                $payId = self::insertPayment($tenantId, (int)$current['client_id'], (int)$current['project_id'], $amc['amount'],
                    $amc['payment_mode'], $amc['payment_date'], $amc['start_date'], $amc['renewal_date'], '', $by);
            }
            $updates['payment_id']   = $payId;
            $updates['payment_mode'] = $amc['payment_mode'];
        } else {
            if ($payment) Database::execute('DELETE FROM ops_payments WHERE id = ? AND tenant_id = ?', [$payId, $tenantId]);
            $updates['payment_id']   = null;
            $updates['payment_mode'] = null;
        }

        Database::update('ops_amc_records', $updates, ['id' => $id, 'tenant_id' => $tenantId]);
        self::log($tenantId, (int)$current['client_id'], 'amc_updated', 'AMC updated — ' . self::describe($amc)
            . ($payment && !$amc['paid'] ? ' (first-year payment of ₹' . number_format((float)$payment['amount']) . ' removed from Finance)' : ''), $by);
    }

    /**
     * Removes an AMC. A first-year payment it recorded goes too, so Finance
     * does not keep money for an AMC that no longer exists; after a renewal,
     * the payments already made stay in Finance.
     */
    public static function remove(int $tenantId, array $current, string $by): void
    {
        if (!self::renewed($current) && $current['payment_id']) {
            Database::execute("DELETE FROM ops_payments WHERE id = ? AND tenant_id = ? AND type = 'amc'", [(int)$current['payment_id'], $tenantId]);
        }
        Database::execute('DELETE FROM ops_amc_records WHERE id = ? AND tenant_id = ?', [(int)$current['id'], $tenantId]);
        self::log($tenantId, (int)$current['client_id'], 'amc_removed', 'AMC removed for ' . ($current['project_name'] ?? 'the project'), $by);
    }

    /**
     * The project form's answer: create, change or remove the project's AMC.
     * A project has one AMC; the earliest record is the one the form edits.
     */
    public static function saveForProject(int $tenantId, array $project, array $amc, string $by): void
    {
        $current = Database::fetch(self::SELECT . ' WHERE a.project_id = ? AND a.tenant_id = ? ORDER BY a.id LIMIT 1', [(int)$project['id'], $tenantId]);
        if ($amc['plan'] === 'none') {
            if ($current) self::remove($tenantId, $current, $by);
            return;
        }
        if ($current) self::update($tenantId, $current, $amc, $by);
        else          self::create($tenantId, $project, $amc, $by);
    }

    /** Collect the current year's AMC; a paid year renews to the next. */
    public static function collect(int $tenantId, array $current, float $amount, string $mode, string $paidOn, string $reference, string $by): void
    {
        $renewing = (int)$current['term_paid'] === 1;
        $start    = $renewing ? (string)$current['renewal_date'] : (string)$current['start_date'];
        $renewal  = $renewing ? self::yearAfter($start) : (string)$current['renewal_date'];
        $payId = self::insertPayment($tenantId, (int)$current['client_id'], (int)$current['project_id'], $amount, $mode, $paidOn, $start, $renewal, $reference, $by);
        Database::update('ops_amc_records', [
            'start_date'   => $start,
            'renewal_date' => $renewal,
            'term_paid'    => 1,
            'payment_id'   => $payId,
            'payment_mode' => $mode,
            'status'       => self::statusFor($renewal),
        ], ['id' => (int)$current['id'], 'tenant_id' => $tenantId]);
        self::log($tenantId, (int)$current['client_id'], 'amc_paid',
            'AMC ' . ($renewing ? 'renewed' : 'paid') . ' — ₹' . number_format($amount) . ' for ' . self::human($start) . ' to ' . self::human($renewal), $by);
    }

    /** True once the contract has rolled on past its first year. */
    public static function renewed(array $row): bool
    {
        return !empty($row['contract_start']) && (string)$row['start_date'] > (string)$row['contract_start'];
    }

    /** overdue once the due date has passed, due within 30 days, active before that. */
    public static function statusFor(string $dueDate): string
    {
        $days = (int) round((strtotime($dueDate) - strtotime(date('Y-m-d'))) / 86400);
        if ($days < 0)   return 'overdue';
        if ($days <= 30) return 'due';
        return 'active';
    }

    public static function find(int $id, int $tenantId): ?array
    {
        return Database::fetch(self::SELECT . ' WHERE a.id = ? AND a.tenant_id = ? LIMIT 1', [$id, $tenantId]) ?: null;
    }

    public static function format(array $row): array
    {
        $free    = (int)($row['first_year_free'] ?? 0) === 1;
        $paid    = (int)($row['term_paid'] ?? 1) === 1;
        $renewed = self::renewed($row);
        return [
            'id'              => (int)$row['id'],
            'client_id'       => (int)$row['client_id'],
            'client_name'     => $row['client_name'] ?? null,
            'client_company'  => $row['client_company'] ?? '',
            'project_id'      => (int)$row['project_id'],
            'project_name'    => $row['project_name'] ?? null,
            'project_code'    => $row['project_code'] ?? null,
            'amount'          => (float)$row['amount'],
            'plan'            => $free ? 'second_year' : 'first_year',
            'first_year_free' => $free,
            'term_paid'       => $paid,
            // Still in the free first year: free, and not renewed yet.
            'in_free_year'    => $free && $paid && !$renewed,
            // The first-year answers can still be changed.
            'renewed'         => $renewed,
            'contract_start'  => $row['contract_start'] ?? $row['start_date'],
            'start_date'      => $row['start_date'],
            'renewal_date'    => $row['renewal_date'],
            'due_date'        => $row['due_date'] ?? $row['renewal_date'],
            'days_until_due'  => isset($row['days_until_due']) ? (int)$row['days_until_due'] : null,
            'status'          => $row['status'],
            'payment_id'      => $row['payment_id'] ? (int)$row['payment_id'] : null,
            'paid_on'         => $row['paid_on'] ?? null,
            'payment_mode'    => $row['payment_mode'],
            'notes'           => $row['notes'],
        ];
    }

    public static function date(mixed $value): ?string
    {
        $value = trim((string)$value);
        $d = \DateTime::createFromFormat('!Y-m-d', $value);
        return $d && $d->format('Y-m-d') === $value ? $value : null;
    }

    public static function yearAfter(string $date): string
    {
        return date('Y-m-d', strtotime($date . ' +1 year'));
    }

    private static function describe(array $amc): string
    {
        $price = '₹' . number_format($amc['amount']) . ' a year';
        if ($amc['free']) return "from the 2nd year, $price, first due " . self::human($amc['renewal_date']);
        return "from the 1st year, $price, first year " . ($amc['paid'] ? 'paid' : 'not paid yet');
    }

    private static function insertPayment(int $tenantId, int $clientId, int $projectId, float $amount, string $mode,
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

    private static function log(int $tenantId, int $clientId, string $action, string $description, string $by): void
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

    private static function human(string $date): string
    {
        return date('j M Y', strtotime($date));
    }
}
