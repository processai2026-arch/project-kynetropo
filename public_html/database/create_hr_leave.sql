-- HR leave management: leave policies, yearly employee balances, requests,
-- and an auditable balance ledger. Every table is tenant scoped.

CREATE TABLE IF NOT EXISTS `hr_leave_types` (
  `leave_type_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `annual_quota` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `is_paid` TINYINT(1) NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`leave_type_id`),
  UNIQUE KEY `uq_hr_leave_type_tenant_name` (`tenant_id`, `name`),
  UNIQUE KEY `uq_hr_leave_type_id_tenant` (`leave_type_id`, `tenant_id`),
  KEY `idx_hr_leave_type_tenant_active` (`tenant_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_leave_balances` (
  `balance_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `employee_key` VARCHAR(12) NOT NULL,
  `leave_type_id` INT NOT NULL,
  `balance_year` SMALLINT UNSIGNED NOT NULL,
  `opening_balance` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `accrued_days` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `adjusted_days` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `used_days` DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  `last_accrual_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`balance_id`),
  UNIQUE KEY `uq_hr_leave_balance_tenant_employee_type_year`
    (`tenant_id`, `employee_key`, `leave_type_id`, `balance_year`),
  UNIQUE KEY `uq_hr_leave_balance_id_tenant` (`balance_id`, `tenant_id`),
  KEY `idx_hr_leave_balance_tenant_year` (`tenant_id`, `balance_year`),
  KEY `idx_hr_leave_balance_employee` (`tenant_id`, `employee_key`),
  CONSTRAINT `fk_hr_leave_balance_type`
    FOREIGN KEY (`leave_type_id`, `tenant_id`)
    REFERENCES `hr_leave_types` (`leave_type_id`, `tenant_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_leave_requests` (
  `leave_request_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `employee_key` VARCHAR(12) NOT NULL,
  `leave_type_id` INT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `requested_days` DECIMAL(8,2) NOT NULL,
  `balance_year` SMALLINT UNSIGNED NOT NULL,
  `reason` VARCHAR(1000) NULL,
  `status` ENUM('submitted','approved','rejected') NOT NULL DEFAULT 'submitted',
  `submitted_by` INT NULL,
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_by` INT NULL,
  `approved_at` DATETIME NULL,
  `rejected_by` INT NULL,
  `rejected_at` DATETIME NULL,
  `rejection_reason` VARCHAR(1000) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`leave_request_id`),
  UNIQUE KEY `uq_hr_leave_request_id_tenant` (`leave_request_id`, `tenant_id`),
  KEY `idx_hr_leave_request_tenant_status` (`tenant_id`, `status`),
  KEY `idx_hr_leave_request_employee_dates`
    (`tenant_id`, `employee_key`, `start_date`, `end_date`),
  KEY `idx_hr_leave_request_calendar` (`tenant_id`, `start_date`, `end_date`),
  CONSTRAINT `fk_hr_leave_request_type`
    FOREIGN KEY (`leave_type_id`, `tenant_id`)
    REFERENCES `hr_leave_types` (`leave_type_id`, `tenant_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `hr_leave_balance_transactions` (
  `transaction_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `balance_id` INT NOT NULL,
  `leave_request_id` INT NULL,
  `transaction_type` ENUM('opening','accrual','approval','adjustment') NOT NULL,
  `days` DECIMAL(8,2) NOT NULL,
  `notes` VARCHAR(500) NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transaction_id`),
  KEY `idx_hr_leave_tx_balance` (`tenant_id`, `balance_id`, `created_at`),
  KEY `idx_hr_leave_tx_request` (`tenant_id`, `leave_request_id`),
  CONSTRAINT `fk_hr_leave_tx_balance`
    FOREIGN KEY (`balance_id`, `tenant_id`)
    REFERENCES `hr_leave_balances` (`balance_id`, `tenant_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_hr_leave_tx_request`
    FOREIGN KEY (`leave_request_id`, `tenant_id`)
    REFERENCES `hr_leave_requests` (`leave_request_id`, `tenant_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
