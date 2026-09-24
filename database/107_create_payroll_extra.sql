-- Payroll module — maker-checker lifecycle + statutory breakdown + bank advice
-- (see docs/MODULE_GAP_ANALYSIS.md, "Payroll and employee advances").
-- Adds: a payroll-run lifecycle table (draft -> reviewed -> approved -> paid -> locked)
-- with maker/checker actor + timestamp columns, per-row lifecycle/statutory columns on
-- `payroll`, and a bank-advice export log. Safe to re-run: every ALTER is guarded via
-- information_schema, every CREATE uses IF NOT EXISTS.

SET @schema_name = DATABASE();

-- ── payroll_runs — one row per tenant+month; the maker-checker lifecycle of record ──
CREATE TABLE IF NOT EXISTS `payroll_runs` (
  `run_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `month` VARCHAR(7) NOT NULL COMMENT 'YYYY-MM',
  `run_status` ENUM('draft','reviewed','approved','paid','locked') NOT NULL DEFAULT 'draft',
  `working_days` INT NOT NULL DEFAULT 0,
  `employee_count` INT NOT NULL DEFAULT 0,
  `total_gross` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_deductions` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_net_pay` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` INT NULL,
  `reviewed_at` DATETIME NULL,
  `review_note` VARCHAR(500) NULL,
  `approved_by` INT NULL,
  `approved_at` DATETIME NULL,
  `approve_note` VARCHAR(500) NULL,
  `paid_by` INT NULL,
  `paid_at` DATETIME NULL,
  `bank_advice_generated_at` DATETIME NULL,
  `bank_advice_generated_by` INT NULL,
  `locked_by` INT NULL,
  `locked_at` DATETIME NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`run_id`),
  UNIQUE KEY `uq_payroll_runs_tenant_month` (`tenant_id`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── payroll.tenant_id — payroll module predates tenancy in some installs ────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'tenant_id') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `tenant_id` INT NOT NULL DEFAULT 1 AFTER `payroll_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── payroll.run_id — link each slip row to its payroll_runs lifecycle record ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'run_id') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `run_id` INT NULL AFTER `tenant_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── payroll.run_status — mirrors payroll_runs.run_status for fast per-row reads ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'run_status') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `run_status` ENUM(''draft'',''reviewed'',''approved'',''paid'',''locked'') NOT NULL DEFAULT ''draft'' AFTER `status`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── payroll.gross_pay — explicit gross (earned + bonus + OT, pre-deduction) ──
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'gross_pay') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `gross_pay` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `total_salary`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── payroll.esi — employee ESI deduction (statutory) ─────────────────────────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'esi') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `esi` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `pf`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── payroll.employer_pf / employer_esi — employer-side statutory contributions (informational, not deducted from net) ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'employer_pf') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `employer_pf` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `esi`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'employer_esi') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `employer_esi` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `employer_pf`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── payroll.tds — income-tax deduction at source ─────────────────────────────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'tds') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `tds` DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `professional_tax`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── payroll.locked — convenience flag mirrored from run_status = 'locked' ───
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'locked') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `locked` TINYINT(1) NOT NULL DEFAULT 0 AFTER `run_status`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── payroll.bank_account_number / bank_ifsc / bank_account_holder — snapshot at run time so a later employee bank-detail edit can't silently change a past bank advice ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'bank_account_holder') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `bank_account_holder` VARCHAR(120) NULL AFTER `tds`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'bank_account_number') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `bank_account_number` VARCHAR(40) NULL AFTER `bank_account_holder`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'bank_ifsc') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `bank_ifsc` VARCHAR(20) NULL AFTER `bank_account_number`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'bank_name') = 0,
  'ALTER TABLE `payroll` ADD COLUMN `bank_name` VARCHAR(120) NULL AFTER `bank_ifsc`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── Unique key so a (tenant, employee, month) slip can be the lock/upsert target ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND INDEX_NAME = 'uq_payroll_tenant_emp_month') = 0,
  'ALTER TABLE `payroll` ADD UNIQUE KEY `uq_payroll_tenant_emp_month` (`tenant_id`, `employee_key`, `month`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── Helpful indexes ───────────────────────────────────────────────────────────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND INDEX_NAME = 'idx_payroll_run_id') = 0,
  'ALTER TABLE `payroll` ADD INDEX `idx_payroll_run_id` (`run_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'payroll' AND INDEX_NAME = 'idx_payroll_tenant_month') = 0,
  'ALTER TABLE `payroll` ADD INDEX `idx_payroll_tenant_month` (`tenant_id`, `month`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── audit_log.tenant_id — guard for installs where this column predates tenancy ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'audit_log' AND COLUMN_NAME = 'tenant_id') = 0,
  'ALTER TABLE `audit_log` ADD COLUMN `tenant_id` INT NULL AFTER `log_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── payroll_bank_advices — log of generated bank-advice (salary disbursement) exports ─
CREATE TABLE IF NOT EXISTS `payroll_bank_advices` (
  `advice_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `run_id` INT NOT NULL,
  `month` VARCHAR(7) NOT NULL,
  `employee_count` INT NOT NULL DEFAULT 0,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `generated_by` INT NULL,
  `generated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`advice_id`),
  KEY `idx_payroll_bank_advices_tenant_month` (`tenant_id`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
