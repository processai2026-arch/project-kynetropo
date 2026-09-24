CREATE TABLE IF NOT EXISTS `marketplace_expenses` (
  `expense_id`    INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`     INT NOT NULL,
  `invoice_id`    INT(11) DEFAULT NULL,
  `category`      VARCHAR(100) NOT NULL,
  `description`   VARCHAR(255) NOT NULL,
  `amount`        DECIMAL(12,2) NOT NULL,
  `expense_date`  DATE NOT NULL,
  `marketplace`   ENUM('amazon','flipkart','meesho','other','none') NOT NULL DEFAULT 'none',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`expense_id`),
  KEY `idx_mp_exp_tenant`          (`tenant_id`),
  KEY `idx_mp_exp_tenant_date`     (`tenant_id`, `expense_date`),
  KEY `idx_mp_exp_tenant_category` (`tenant_id`, `category`),
  CONSTRAINT `fk_mp_exp_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
