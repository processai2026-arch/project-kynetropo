<?php
declare(strict_types=1);

/**
 * Double-entry accounting endpoints. All data is tenant-scoped and reports
 * include posted journals only.
 */
class AdminLedgerController
{
    public function accounts(Request $request): void
    {
        $includeInactive = filter_var(
            $request->query('include_inactive', 'true'),
            FILTER_VALIDATE_BOOLEAN
        );
        Response::success(Account::all($includeInactive));
    }

    public function showAccount(Request $request): void
    {
        Response::success($this->accountOrFail((int)$request->param('id')));
    }

    public function storeAccount(Request $request): void
    {
        $data = $this->accountPayload($request, true);
        if (Account::codeExists($data['code'])) {
            Response::error('Account code already exists', 409);
        }

        try {
            $id = Account::create($data);
        } catch (PDOException $e) {
            $this->handleAccountDbError($e);
        }
        Response::success(Account::find($id), 'Account created', 201);
    }

    public function updateAccount(Request $request): void
    {
        $id = (int)$request->param('id');
        $this->accountOrFail($id);
        $data = $this->accountPayload($request, false);
        if (!$data) {
            Response::error('Provide at least one field to update', 400);
        }
        if (isset($data['code']) && Account::codeExists($data['code'], $id)) {
            Response::error('Account code already exists', 409);
        }

        try {
            Account::update($id, $data);
        } catch (PDOException $e) {
            $this->handleAccountDbError($e);
        }
        Response::success(Account::find($id), 'Account updated');
    }

    public function destroyAccount(Request $request): void
    {
        $id = (int)$request->param('id');
        $this->accountOrFail($id);
        if (Account::hasJournalLines($id)) {
            Response::error('Account has journal activity and cannot be deleted; deactivate it instead', 409);
        }

        Account::delete($id);
        Response::success(null, 'Account deleted');
    }

    public function journals(Request $request): void
    {
        $filters = [
            'status' => trim((string)$request->query('status', '')),
            'from' => trim((string)$request->query('from', '')),
            'to' => trim((string)$request->query('to', '')),
        ];
        if ($filters['from'] !== '') {
            $this->validateDate($filters['from'], 'from');
        }
        if ($filters['to'] !== '') {
            $this->validateDate($filters['to'], 'to');
        }
        Response::success(JournalEntry::all($filters));
    }

    public function showJournal(Request $request): void
    {
        Response::success($this->journalOrFail((int)$request->param('id')));
    }

    public function storeJournal(Request $request): void
    {
        Validator::make(
            $request->only(['entry_date', 'description', 'lines']),
            [
                'entry_date' => 'required|string|max:10',
                'description' => 'required|string|min:2|max:500',
                'lines' => 'required|array',
            ]
        )->validate();

        $entryDate = trim((string)$request->input('entry_date'));
        $description = trim((string)$request->input('description'));
        $reference = trim((string)$request->input('reference', ''));
        $this->validateDate($entryDate, 'entry_date');
        if (mb_strlen($reference) > 100) {
            Response::error('reference must not exceed 100 characters', 422);
        }

        $lines = $this->validatedLines($request->input('lines'));
        try {
            $id = JournalEntry::create(
                [
                    'entry_date' => $entryDate,
                    'reference' => $reference,
                    'description' => $description,
                    'created_by' => isset($request->user['user_id']) ? (int)$request->user['user_id'] : null,
                ],
                $lines
            );
            if (filter_var($request->input('post', false), FILTER_VALIDATE_BOOLEAN)) {
                JournalEntry::post(
                    $id,
                    isset($request->user['user_id']) ? (int)$request->user['user_id'] : null
                );
            }
        } catch (PDOException $e) {
            error_log('Journal create error: ' . $e->getMessage());
            Response::error('Could not create journal entry', 500);
        }

        Response::success(JournalEntry::find($id), 'Journal entry created', 201);
    }

    public function postJournal(Request $request): void
    {
        $id = (int)$request->param('id');
        $this->journalOrFail($id);
        JournalEntry::post(
            $id,
            isset($request->user['user_id']) ? (int)$request->user['user_id'] : null
        );
        Response::success(JournalEntry::find($id), 'Journal entry posted');
    }

    public function trialBalance(Request $request): void
    {
        $asOf = trim((string)$request->query('as_of', date('Y-m-d')));
        $this->validateDate($asOf, 'as_of');

        $rows = Database::fetchAll(
            'SELECT a.account_id, a.code, a.name, a.type,
                    COALESCE(SUM(CASE WHEN je.journal_entry_id IS NOT NULL THEN jl.debit ELSE 0 END), 0) AS total_debit,
                    COALESCE(SUM(CASE WHEN je.journal_entry_id IS NOT NULL THEN jl.credit ELSE 0 END), 0) AS total_credit
             FROM accounts a
             LEFT JOIN journal_lines jl
               ON jl.account_id = a.account_id AND jl.tenant_id = a.tenant_id
             LEFT JOIN journal_entries je
               ON je.journal_entry_id = jl.journal_entry_id
              AND je.tenant_id = jl.tenant_id
              AND je.status = "posted"
              AND je.entry_date <= ?
             WHERE a.tenant_id = ?
             GROUP BY a.account_id, a.code, a.name, a.type
             ORDER BY FIELD(a.type, "asset", "liability", "equity", "income", "expense"), a.code ASC',
            [$asOf, Database::tenantId()]
        );

        $totalDebit = 0.0;
        $totalCredit = 0.0;
        foreach ($rows as &$row) {
            $debit = round((float)$row['total_debit'], 2);
            $credit = round((float)$row['total_credit'], 2);
            $balance = round($debit - $credit, 2);
            $row['account_id'] = (int)$row['account_id'];
            $row['total_debit'] = $debit;
            $row['total_credit'] = $credit;
            $row['closing_debit'] = $balance > 0 ? $balance : 0.0;
            $row['closing_credit'] = $balance < 0 ? abs($balance) : 0.0;
            $totalDebit += $row['closing_debit'];
            $totalCredit += $row['closing_credit'];
        }
        unset($row);

        Response::success([
            'as_of' => $asOf,
            'accounts' => $rows,
            'total_debit' => round($totalDebit, 2),
            'total_credit' => round($totalCredit, 2),
            'balanced' => abs($totalDebit - $totalCredit) <= 0.005,
        ]);
    }

    public function profitLoss(Request $request): void
    {
        [$from, $to] = $this->dateWindow($request);
        $rows = Database::fetchAll(
            'SELECT a.account_id, a.code, a.name, a.type,
                    COALESCE(SUM(CASE WHEN je.journal_entry_id IS NOT NULL THEN jl.debit ELSE 0 END), 0) AS debit,
                    COALESCE(SUM(CASE WHEN je.journal_entry_id IS NOT NULL THEN jl.credit ELSE 0 END), 0) AS credit
             FROM accounts a
             LEFT JOIN journal_lines jl
               ON jl.account_id = a.account_id AND jl.tenant_id = a.tenant_id
             LEFT JOIN journal_entries je
               ON je.journal_entry_id = jl.journal_entry_id
              AND je.tenant_id = jl.tenant_id
              AND je.status = "posted"
              AND je.entry_date BETWEEN ? AND ?
             WHERE a.tenant_id = ? AND a.type IN ("income", "expense")
             GROUP BY a.account_id, a.code, a.name, a.type
             ORDER BY FIELD(a.type, "income", "expense"), a.code ASC',
            [$from, $to, Database::tenantId()]
        );

        $income = [];
        $expenses = [];
        $totalIncome = 0.0;
        $totalExpenses = 0.0;
        foreach ($rows as $row) {
            $amount = $row['type'] === 'income'
                ? (float)$row['credit'] - (float)$row['debit']
                : (float)$row['debit'] - (float)$row['credit'];
            $item = [
                'account_id' => (int)$row['account_id'],
                'code' => $row['code'],
                'name' => $row['name'],
                'amount' => round($amount, 2),
            ];
            if ($row['type'] === 'income') {
                $income[] = $item;
                $totalIncome += $amount;
            } else {
                $expenses[] = $item;
                $totalExpenses += $amount;
            }
        }

        Response::success([
            'from' => $from,
            'to' => $to,
            'income' => $income,
            'expenses' => $expenses,
            'total_income' => round($totalIncome, 2),
            'total_expenses' => round($totalExpenses, 2),
            'net_profit' => round($totalIncome - $totalExpenses, 2),
        ]);
    }

    public function balanceSheet(Request $request): void
    {
        $asOf = trim((string)$request->query('as_of', date('Y-m-d')));
        $this->validateDate($asOf, 'as_of');
        $rows = Database::fetchAll(
            'SELECT a.account_id, a.code, a.name, a.type,
                    COALESCE(SUM(CASE WHEN je.journal_entry_id IS NOT NULL THEN jl.debit ELSE 0 END), 0) AS debit,
                    COALESCE(SUM(CASE WHEN je.journal_entry_id IS NOT NULL THEN jl.credit ELSE 0 END), 0) AS credit
             FROM accounts a
             LEFT JOIN journal_lines jl
               ON jl.account_id = a.account_id AND jl.tenant_id = a.tenant_id
             LEFT JOIN journal_entries je
               ON je.journal_entry_id = jl.journal_entry_id
              AND je.tenant_id = jl.tenant_id
              AND je.status = "posted"
              AND je.entry_date <= ?
             WHERE a.tenant_id = ?
             GROUP BY a.account_id, a.code, a.name, a.type
             ORDER BY FIELD(a.type, "asset", "liability", "equity", "income", "expense"), a.code ASC',
            [$asOf, Database::tenantId()]
        );

        $groups = ['assets' => [], 'liabilities' => [], 'equity' => []];
        $totals = ['assets' => 0.0, 'liabilities' => 0.0, 'equity' => 0.0];
        $retainedEarnings = 0.0;
        foreach ($rows as $row) {
            $debit = (float)$row['debit'];
            $credit = (float)$row['credit'];
            if ($row['type'] === 'income') {
                $retainedEarnings += $credit - $debit;
                continue;
            }
            if ($row['type'] === 'expense') {
                $retainedEarnings -= $debit - $credit;
                continue;
            }

            $group = $row['type'] === 'asset' ? 'assets' : ($row['type'] === 'liability' ? 'liabilities' : 'equity');
            $amount = $row['type'] === 'asset' ? $debit - $credit : $credit - $debit;
            $groups[$group][] = [
                'account_id' => (int)$row['account_id'],
                'code' => $row['code'],
                'name' => $row['name'],
                'amount' => round($amount, 2),
            ];
            $totals[$group] += $amount;
        }

        $totalEquity = $totals['equity'] + $retainedEarnings;
        $liabilitiesAndEquity = $totals['liabilities'] + $totalEquity;
        Response::success([
            'as_of' => $asOf,
            'assets' => $groups['assets'],
            'liabilities' => $groups['liabilities'],
            'equity' => $groups['equity'],
            'retained_earnings' => round($retainedEarnings, 2),
            'total_assets' => round($totals['assets'], 2),
            'total_liabilities' => round($totals['liabilities'], 2),
            'total_equity' => round($totalEquity, 2),
            'total_liabilities_and_equity' => round($liabilitiesAndEquity, 2),
            'balanced' => abs($totals['assets'] - $liabilitiesAndEquity) <= 0.005,
        ]);
    }

    private function accountPayload(Request $request, bool $creating): array
    {
        $provided = $request->only(['code', 'name', 'type', 'description', 'is_active']);
        if ($creating) {
            Validator::make(
                $provided,
                [
                    'code' => 'required|string|min:1|max:30',
                    'name' => 'required|string|min:2|max:120',
                    'type' => 'required|string|in:asset,liability,equity,income,expense',
                ]
            )->validate();
        }

        $data = [];
        foreach ($provided as $field => $value) {
            if ($field === 'is_active') {
                $data[$field] = filter_var($value, FILTER_VALIDATE_BOOLEAN);
            } else {
                $data[$field] = trim((string)$value);
            }
        }
        if (isset($data['code'])) {
            $data['code'] = strtoupper($data['code']);
            if ($data['code'] === '' || mb_strlen($data['code']) > 30) {
                Response::error('Account code must be 1 to 30 characters', 422);
            }
        }
        if (isset($data['name']) && (mb_strlen($data['name']) < 2 || mb_strlen($data['name']) > 120)) {
            Response::error('Account name must be 2 to 120 characters', 422);
        }
        if (isset($data['type']) && !in_array($data['type'], Account::TYPES, true)) {
            Response::error('Invalid account type', 422);
        }
        if (isset($data['description']) && mb_strlen($data['description']) > 500) {
            Response::error('Description must not exceed 500 characters', 422);
        }
        if ($creating) {
            $data += ['description' => '', 'is_active' => true];
        }
        return $data;
    }

    private function validatedLines(mixed $input): array
    {
        if (!is_array($input) || count($input) < 2) {
            Response::error('At least two journal lines are required', 422);
        }
        if (count($input) > 200) {
            Response::error('A journal entry cannot exceed 200 lines', 422);
        }

        $lines = [];
        $totalDebit = 0.0;
        $totalCredit = 0.0;
        foreach (array_values($input) as $index => $line) {
            if (!is_array($line)) {
                Response::error('Each journal line must be an object', 422);
            }
            $accountId = (int)($line['account_id'] ?? 0);
            $debit = round((float)($line['debit'] ?? 0), 2);
            $credit = round((float)($line['credit'] ?? 0), 2);
            $description = trim((string)($line['description'] ?? ''));

            $account = Account::find($accountId);
            if (!$account || !$account['is_active']) {
                Response::error('Line ' . ($index + 1) . ' references an invalid or inactive account', 422);
            }
            if ($debit < 0 || $credit < 0 || ($debit <= 0 && $credit <= 0) || ($debit > 0 && $credit > 0)) {
                Response::error('Line ' . ($index + 1) . ' must have a positive debit or credit, but not both', 422);
            }
            if ($debit > 9999999999999.99 || $credit > 9999999999999.99) {
                Response::error('Line ' . ($index + 1) . ' amount exceeds the supported limit', 422);
            }
            if (mb_strlen($description) > 255) {
                Response::error('Line ' . ($index + 1) . ' description must not exceed 255 characters', 422);
            }

            $lines[] = [
                'account_id' => $accountId,
                'description' => $description,
                'debit' => $debit,
                'credit' => $credit,
            ];
            $totalDebit += $debit;
            $totalCredit += $credit;
        }

        $totalDebit = round($totalDebit, 2);
        $totalCredit = round($totalCredit, 2);
        if ($totalDebit <= 0 || abs($totalDebit - $totalCredit) > 0.005) {
            Response::error(
                'Journal entry is not balanced: debit ' . number_format($totalDebit, 2)
                . ' does not equal credit ' . number_format($totalCredit, 2),
                422
            );
        }
        return $lines;
    }

    private function accountOrFail(int $id): array
    {
        if ($id <= 0) {
            Response::error('Invalid account ID', 400);
        }
        $account = Account::find($id);
        if (!$account) {
            Response::error('Account not found', 404);
        }
        return $account;
    }

    private function journalOrFail(int $id): array
    {
        if ($id <= 0) {
            Response::error('Invalid journal entry ID', 400);
        }
        $entry = JournalEntry::find($id);
        if (!$entry) {
            Response::error('Journal entry not found', 404);
        }
        return $entry;
    }

    private function dateWindow(Request $request): array
    {
        $to = trim((string)$request->query('to', date('Y-m-d')));
        $from = trim((string)$request->query('from', date('Y-01-01')));
        $this->validateDate($from, 'from');
        $this->validateDate($to, 'to');
        if ($from > $to) {
            Response::error('from must be earlier than or equal to to', 422);
        }
        return [$from, $to];
    }

    private function validateDate(string $value, string $field): void
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        $errors = DateTimeImmutable::getLastErrors();
        if (
            !$date
            || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
            || $date->format('Y-m-d') !== $value
        ) {
            Response::error("{$field} must be a valid YYYY-MM-DD date", 422);
        }
    }

    private function handleAccountDbError(PDOException $e): void
    {
        error_log('Account database error: ' . $e->getMessage());
        if ($e->getCode() === '23000') {
            Response::error('Account code must be unique within the tenant', 409);
        }
        Response::error('Account database operation failed', 500);
    }
}
