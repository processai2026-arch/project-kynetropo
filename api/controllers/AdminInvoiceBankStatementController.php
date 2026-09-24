<?php
declare(strict_types=1);

/**
 * Admin Invoice Bank Statement Controller
 * GET  /admin/bank-statements/entries          — list reconciliation entries
 * POST /admin/bank-statements/upload           — upload statement file (stub)
 * POST /admin/bank-statements/reconcile/run    — run reconciliation (stub)
 * POST /admin/bank-statements/entries/{id}/match — manually match entry (stub)
 * GET  /admin/bank-statements                  — list uploaded statements
 *
 * Phase 1: Returns structured stubs — real parsing requires server-side CSV/PDF
 * processing which is deferred to Phase 2.
 */
class AdminInvoiceBankStatementController
{
    private function ensureTables(): void
    {
        Database::execute(
            'CREATE TABLE IF NOT EXISTS `bank_statement_uploads` (
              `upload_id`    INT(11) NOT NULL AUTO_INCREMENT,
              `tenant_id`    INT NOT NULL,
              `filename`     VARCHAR(255) NOT NULL,
              `stmt_type`    VARCHAR(20) NOT NULL DEFAULT "all",
              `status`       VARCHAR(20) NOT NULL DEFAULT "uploaded",
              `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (`upload_id`),
              KEY `idx_bsu_tenant` (`tenant_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            []
        );
        Database::execute(
            'CREATE TABLE IF NOT EXISTS `bank_statement_entries` (
              `entry_id`          INT(11) NOT NULL AUTO_INCREMENT,
              `tenant_id`         INT NOT NULL,
              `upload_id`         INT(11) DEFAULT NULL,
              `transaction_date`  DATE DEFAULT NULL,
              `description`       VARCHAR(500) DEFAULT NULL,
              `credit_amount`     DECIMAL(12,2) DEFAULT 0.00,
              `debit_amount`      DECIMAL(12,2) DEFAULT 0.00,
              `transaction_type`  VARCHAR(20) DEFAULT "credit",
              `match_status`      VARCHAR(20) DEFAULT "unmatched",
              `matched_reference` VARCHAR(100) DEFAULT NULL,
              `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `updated_at`        DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (`entry_id`),
              KEY `idx_bse_tenant` (`tenant_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
            []
        );
    }

    // GET /admin/bank-statements
    public function index(Request $request): void
    {
        $this->ensureTables();
        $tid  = Database::tenantId();
        $rows = Database::fetchAll(
            'SELECT upload_id AS id, filename, stmt_type, status, created_at
             FROM bank_statement_uploads WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20',
            [$tid]
        );
        Response::success($rows);
    }

    // GET /admin/bank-statements/entries
    public function entries(Request $request): void
    {
        $this->ensureTables();
        $tid    = Database::tenantId();
        $status = $request->query('status');
        $where  = ['tenant_id = ?'];
        $params = [$tid];
        if ($status && $status !== 'all') {
            $where[] = 'match_status = ?'; $params[] = $status;
        }
        $wc   = implode(' AND ', $where);
        $rows = Database::fetchAll(
            "SELECT * FROM bank_statement_entries WHERE $wc ORDER BY transaction_date DESC LIMIT 100",
            $params
        );
        $total    = (int)(Database::fetch("SELECT COUNT(*) AS cnt FROM bank_statement_entries WHERE $wc", $params)['cnt'] ?? 0);
        $matched  = (int)(Database::fetch("SELECT COUNT(*) AS cnt FROM bank_statement_entries WHERE tenant_id = ? AND match_status = 'matched'", [$tid])['cnt'] ?? 0);
        $partial  = (int)(Database::fetch("SELECT COUNT(*) AS cnt FROM bank_statement_entries WHERE tenant_id = ? AND match_status = 'partial'", [$tid])['cnt'] ?? 0);
        $unmatched = max(0, $total - $matched - $partial);
        foreach ($rows as &$r) {
            $r['credit_amount']     = (float)$r['credit_amount'];
            $r['debit_amount']      = (float)$r['debit_amount'];
            // Normalise field names to match frontend expectations
            $r['reconcile_status']  = $r['match_status'];
            $isCredit = (float)$r['credit_amount'] > 0;
            $r['amount']            = $isCredit ? (float)$r['credit_amount'] : (float)$r['debit_amount'];
            $r['type']              = $isCredit ? 'credit' : 'debit';
            $r['reference']         = $r['matched_reference'] ?? null;
        }
        Response::success($rows);
    }

    // POST /admin/bank-statements/upload
    public function upload(Request $request): void
    {
        $this->ensureTables();
        $tid      = Database::tenantId();
        $stmtType = $request->input('statement_type') ?: 'all';

        if (empty($_FILES['file'])) {
            Response::error('file is required', 422);
        }
        $file     = $_FILES['file'];
        $filename = Request::sanitize(basename($file['name']));

        $uploadId = Database::insert(
            'INSERT INTO bank_statement_uploads (tenant_id, filename, stmt_type, status, created_at)
             VALUES (?, ?, ?, "uploaded", NOW())',
            [$tid, $filename, $stmtType]
        );

        Response::success([
            'upload_id'  => $uploadId,
            'filename'   => $filename,
            'status'     => 'uploaded',
            'message'    => 'Statement uploaded. Run reconciliation to match transactions.',
        ], 'Statement uploaded', 201);
    }

    // POST /admin/bank-statements/reconcile/run
    public function runReconciliation(Request $request): void
    {
        $this->ensureTables();
        $tid = Database::tenantId();

        // Auto-match: compare entry amounts to sales orders
        $entries  = Database::fetchAll(
            'SELECT entry_id, credit_amount, transaction_date FROM bank_statement_entries
             WHERE tenant_id = ? AND match_status = "unmatched" AND credit_amount > 0',
            [$tid]
        );
        $matched  = 0;
        foreach ($entries as $e) {
            $order = Database::fetch(
                'SELECT order_id, order_number FROM marketplace_sales_orders
                 WHERE tenant_id = ? AND ABS(total_amount - ?) < 1 AND order_date = ? LIMIT 1',
                [$tid, (float)$e['credit_amount'], $e['transaction_date']]
            );
            if ($order) {
                Database::execute(
                    'UPDATE bank_statement_entries SET match_status = "matched", matched_reference = ?, updated_at = NOW() WHERE entry_id = ? AND tenant_id = ?',
                    [$order['order_number'], $e['entry_id'], $tid]
                );
                $matched++;
            }
        }

        Response::success([
            'total_processed' => count($entries),
            'matched'         => $matched,
            'unmatched'       => count($entries) - $matched,
        ], 'Reconciliation complete');
    }

    // POST /admin/bank-statements/entries/{id}/match
    public function matchEntry(Request $request): void
    {
        $this->ensureTables();
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        $ref = $request->input('reference') ?: 'manual';
        Database::execute(
            'UPDATE bank_statement_entries SET match_status = "matched", matched_reference = ?, updated_at = NOW()
             WHERE entry_id = ? AND tenant_id = ?',
            [Request::sanitize((string)$ref), $id, $tid]
        );
        Response::success(null, 'Entry matched');
    }

    // POST /admin/bank-statements/entries/{id}/accept
    public function acceptEntry(Request $request): void
    {
        $this->ensureTables();
        $id  = (int)$request->param('id');
        $tid = Database::tenantId();
        Database::execute(
            'UPDATE bank_statement_entries SET match_status = "matched", matched_reference = "accepted", updated_at = NOW()
             WHERE entry_id = ? AND tenant_id = ?',
            [$id, $tid]
        );
        Response::success(null, 'Entry accepted');
    }
}
