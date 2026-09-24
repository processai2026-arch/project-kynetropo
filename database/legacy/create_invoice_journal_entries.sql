CREATE TABLE IF NOT EXISTS `invoice_journal_entries` (
  `entry_id`       INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`      INT NOT NULL,
  `invoice_id`     INT(11) DEFAULT NULL,
  `entry_date`     DATE NOT NULL,
  `entry_number`   VARCHAR(50) NOT NULL,
  `description`    TEXT NOT NULL,
  `debit_account`  VARCHAR(100) NOT NULL,
  `credit_account` VARCHAR(100) NOT NULL,
  `amount`         DECIMAL(12,2) NOT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`entry_id`),
  KEY `idx_inv_journal_tenant`      (`tenant_id`),
  KEY `idx_inv_journal_tenant_date` (`tenant_id`, `entry_date`),
  KEY `idx_inv_journal_invoice`     (`invoice_id`),
  CONSTRAINT `fk_inv_journal_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
