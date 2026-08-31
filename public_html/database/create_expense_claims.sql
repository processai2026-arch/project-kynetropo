-- Employee expense claims: submit -> approve/reject -> reimburse.
-- Policy limits are warning-only and are snapshotted on each claim item.

CREATE TABLE IF NOT EXISTS `expense_claims` (
  `claim_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `claim_number` VARCHAR(30) NOT NULL,
  `employee_key` VARCHAR(20) NOT NULL,
  `claimant_user_id` INT NULL,
  `purpose` VARCHAR(500) NOT NULL,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('pending','approved','rejected','reimbursed') NOT NULL DEFAULT 'pending',
  `has_policy_warnings` TINYINT(1) NOT NULL DEFAULT 0,
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_by` INT NULL,
  `approved_at` DATETIME NULL,
  `approval_note` VARCHAR(500) NULL,
  `rejected_by` INT NULL,
  `rejected_at` DATETIME NULL,
  `rejection_reason` VARCHAR(500) NULL,
  `reimbursed_by` INT NULL,
  `reimbursed_at` DATETIME NULL,
  `reimbursement_date` DATE NULL,
  `reimbursement_reference` VARCHAR(120) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`claim_id`),
  UNIQUE KEY `uq_expense_claims_tenant_number` (`tenant_id`, `claim_number`),
  UNIQUE KEY `uq_expense_claims_tenant_id` (`tenant_id`, `claim_id`),
  KEY `idx_expense_claims_tenant_status` (`tenant_id`, `status`, `submitted_at`),
  KEY `idx_expense_claims_tenant_employee` (`tenant_id`, `employee_key`, `submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `expense_claim_items` (
  `item_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `claim_id` INT NOT NULL,
  `expense_date` DATE NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `receipt_url` LONGTEXT NULL,
  `policy_limit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `policy_warning` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`),
  KEY `idx_expense_claim_items_claim` (`tenant_id`, `claim_id`, `sort_order`),
  KEY `idx_expense_claim_items_category` (`tenant_id`, `category`),
  CONSTRAINT `fk_expense_claim_items_claim`
    FOREIGN KEY (`tenant_id`, `claim_id`)
    REFERENCES `expense_claims` (`tenant_id`, `claim_id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
