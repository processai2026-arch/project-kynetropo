-- Double-entry accounting module.
-- Run this file after the base users/tenant schema has been installed.

CREATE TABLE IF NOT EXISTS `accounts` (
  `account_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `code` VARCHAR(30) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `type` ENUM('asset', 'liability', 'equity', 'income', 'expense') NOT NULL,
  `description` VARCHAR(500) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`account_id`),
  UNIQUE KEY `uq_accounts_tenant_code` (`tenant_id`, `code`),
  UNIQUE KEY `uq_accounts_tenant_id` (`tenant_id`, `account_id`),
  KEY `idx_accounts_tenant_type_active` (`tenant_id`, `type`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_entries` (
  `journal_entry_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `entry_number` VARCHAR(40) NOT NULL,
  `entry_date` DATE NOT NULL,
  `reference` VARCHAR(100) NULL,
  `description` VARCHAR(500) NOT NULL,
  `status` ENUM('draft', 'posted') NOT NULL DEFAULT 'draft',
  `created_by` INT NULL,
  `posted_by` INT NULL,
  `posted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`journal_entry_id`),
  UNIQUE KEY `uq_journal_entries_tenant_number` (`tenant_id`, `entry_number`),
  UNIQUE KEY `uq_journal_entries_tenant_id` (`tenant_id`, `journal_entry_id`),
  KEY `idx_journal_entries_tenant_date_status` (`tenant_id`, `entry_date`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `journal_lines` (
  `journal_line_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `journal_entry_id` INT NOT NULL,
  `account_id` INT NOT NULL,
  `description` VARCHAR(255) NULL,
  `debit` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `credit` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`journal_line_id`),
  KEY `idx_journal_lines_tenant_entry` (`tenant_id`, `journal_entry_id`, `sort_order`),
  KEY `idx_journal_lines_tenant_account` (`tenant_id`, `account_id`),
  CONSTRAINT `fk_journal_lines_entry_tenant`
    FOREIGN KEY (`tenant_id`, `journal_entry_id`)
    REFERENCES `journal_entries` (`tenant_id`, `journal_entry_id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_journal_lines_account_tenant`
    FOREIGN KEY (`tenant_id`, `account_id`)
    REFERENCES `accounts` (`tenant_id`, `account_id`)
    ON DELETE RESTRICT,
  CONSTRAINT `chk_journal_lines_nonnegative`
    CHECK (`debit` >= 0 AND `credit` >= 0),
  CONSTRAINT `chk_journal_lines_one_side`
    CHECK ((`debit` > 0 AND `credit` = 0) OR (`credit` > 0 AND `debit` = 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
