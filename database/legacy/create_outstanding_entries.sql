-- Outstanding credit entries + payment tracking
-- Created at invoice approval time when is_credit_sale = 1
-- Run AFTER: create_scan_invoices.sql

CREATE TABLE IF NOT EXISTS `outstanding_entries` (
  `entry_id`       INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`      INT NOT NULL,
  `invoice_id`     INT(11) NOT NULL,
  `type`           ENUM('receivable','payable') NOT NULL
                   COMMENT 'receivable=credit sale, payable=credit purchase',
  `party_name`     VARCHAR(255) NOT NULL,
  `party_gstin`    VARCHAR(15) DEFAULT NULL,
  `invoice_number` VARCHAR(100) DEFAULT NULL,
  `invoice_date`   DATE DEFAULT NULL,
  `due_date`       DATE DEFAULT NULL
                   COMMENT 'invoice_date + credit_days',
  `total_amount`   DECIMAL(12,2) NOT NULL,
  `paid_amount`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `balance_amount` DECIMAL(12,2) NOT NULL
                   COMMENT 'total_amount - paid_amount, updated on each payment',
  `status`         ENUM('pending','partial','paid') NOT NULL DEFAULT 'pending',
  `credit_days`    INT NOT NULL DEFAULT 30,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`entry_id`),
  KEY `idx_oe_tenant`        (`tenant_id`),
  KEY `idx_oe_tenant_type`   (`tenant_id`, `type`),
  KEY `idx_oe_tenant_status` (`tenant_id`, `status`),
  KEY `idx_oe_invoice`       (`invoice_id`),
  CONSTRAINT `fk_oe_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `outstanding_payments` (
  `payment_id`     INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`      INT NOT NULL,
  `entry_id`       INT(11) NOT NULL,
  `amount`         DECIMAL(12,2) NOT NULL,
  `payment_date`   DATE NOT NULL,
  `payment_method` VARCHAR(50) DEFAULT NULL
                   COMMENT 'cash, bank_transfer, upi, cheque, card, other',
  `notes`          TEXT DEFAULT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`payment_id`),
  KEY `idx_op_tenant`  (`tenant_id`),
  KEY `idx_op_entry`   (`entry_id`),
  CONSTRAINT `fk_op_entry` FOREIGN KEY (`entry_id`) REFERENCES `outstanding_entries` (`entry_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
