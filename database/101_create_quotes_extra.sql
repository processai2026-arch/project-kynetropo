-- Quotes module — P1/P2 gap closure (see docs/MODULE_GAP_ANALYSIS.md, "Quotes and quote requests").
-- Adds: quote validity, customer accept/decline tracking, conversion-to-order link,
-- and actual email delivery tracking for the inbound quote-request flow.
-- Safe to re-run: every ALTER is guarded via information_schema, every CREATE uses IF NOT EXISTS.

SET @schema_name = DATABASE();

-- ── quotes.valid_until — quotation validity/expiry date ─────────────────────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND COLUMN_NAME = 'valid_until') = 0,
  'ALTER TABLE `quotes` ADD COLUMN `valid_until` DATE NULL AFTER `quoted_price`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── quotes.accepted_at / accepted_by — customer acceptance record ───────────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND COLUMN_NAME = 'accepted_at') = 0,
  'ALTER TABLE `quotes` ADD COLUMN `accepted_at` DATETIME NULL AFTER `valid_until`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND COLUMN_NAME = 'accepted_by') = 0,
  'ALTER TABLE `quotes` ADD COLUMN `accepted_by` INT NULL AFTER `accepted_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── quotes.declined_at / decline_reason — customer decline record ───────────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND COLUMN_NAME = 'declined_at') = 0,
  'ALTER TABLE `quotes` ADD COLUMN `declined_at` DATETIME NULL AFTER `accepted_by`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND COLUMN_NAME = 'decline_reason') = 0,
  'ALTER TABLE `quotes` ADD COLUMN `decline_reason` VARCHAR(255) NULL AFTER `declined_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── quotes.decided_by_name — free-text label of who accepted/declined (customer-portal-less flow: admin records on the customer's behalf) ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND COLUMN_NAME = 'decided_by_name') = 0,
  'ALTER TABLE `quotes` ADD COLUMN `decided_by_name` VARCHAR(150) NULL AFTER `decline_reason`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── quotes.email_sent_at / email_delivery_status — actual mailer delivery result ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND COLUMN_NAME = 'email_sent_at') = 0,
  'ALTER TABLE `quotes` ADD COLUMN `email_sent_at` DATETIME NULL AFTER `decided_by_name`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND COLUMN_NAME = 'email_delivery_status') = 0,
  'ALTER TABLE `quotes` ADD COLUMN `email_delivery_status` VARCHAR(20) NULL AFTER `email_sent_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── quotes.sales_document_id — link inbound quote request to a structured quotation ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND COLUMN_NAME = 'sales_document_id') = 0,
  'ALTER TABLE `quotes` ADD COLUMN `sales_document_id` INT NULL AFTER `email_delivery_status`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── quotes.converted_order_id — accepted quote -> sales order link ──────────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND COLUMN_NAME = 'converted_order_id') = 0,
  'ALTER TABLE `quotes` ADD COLUMN `converted_order_id` INT NULL AFTER `sales_document_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── Indexes for the new lookup columns (guarded — MySQL has no "ADD INDEX IF NOT EXISTS") ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND INDEX_NAME = 'idx_quotes_sales_document') = 0,
  'ALTER TABLE `quotes` ADD INDEX `idx_quotes_sales_document` (`sales_document_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND INDEX_NAME = 'idx_quotes_converted_order') = 0,
  'ALTER TABLE `quotes` ADD INDEX `idx_quotes_converted_order` (`converted_order_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
