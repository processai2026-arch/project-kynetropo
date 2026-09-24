-- Vendor Credits + vendor-bill approval audit (procurement). Tenant-scoped.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + information_schema-guarded ALTERs.

CREATE TABLE IF NOT EXISTS `vendor_credits` (
  `credit_id`       INT NOT NULL AUTO_INCREMENT,
  `tenant_id`       INT NOT NULL,
  `vendor_id`       INT NOT NULL,
  `vendor_bill_id`  INT NULL,
  `credit_number`   VARCHAR(40) NOT NULL,
  `credit_date`     DATE NOT NULL,
  `reason`          VARCHAR(255) NULL,
  `amount`          DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status`          ENUM('draft','applied','void') NOT NULL DEFAULT 'draft',
  `notes`           TEXT NULL,
  `created_by`      INT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`credit_id`),
  KEY `idx_vendor_credits_tenant` (`tenant_id`),
  KEY `idx_vendor_credits_vendor` (`tenant_id`, `vendor_id`),
  KEY `idx_vendor_credits_bill` (`tenant_id`, `vendor_bill_id`),
  KEY `idx_vendor_credits_status` (`tenant_id`, `status`),
  UNIQUE KEY `uq_vendor_credits_number` (`tenant_id`, `credit_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vendor-bill approval audit columns (the status lifecycle already exists on vendor_bills).
SET @schema_name = DATABASE();
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='vendor_bills' AND COLUMN_NAME='approved_by')=0,
  'ALTER TABLE `vendor_bills` ADD COLUMN `approved_by` INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='vendor_bills' AND COLUMN_NAME='approved_at')=0,
  'ALTER TABLE `vendor_bills` ADD COLUMN `approved_at` DATETIME NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
