-- Phase 2 Purchase Order header extensions. Safe to re-run on MySQL 8.
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'reference_number') = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `reference_number` VARCHAR(80) NULL AFTER `po_number`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'shipment_preference') = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `shipment_preference` VARCHAR(80) NULL AFTER `expected_date`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'deliver_to_type') = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `deliver_to_type` VARCHAR(40) NULL AFTER `shipment_preference`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'deliver_to_name') = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `deliver_to_name` VARCHAR(160) NULL AFTER `deliver_to_type`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'deliver_to_address') = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `deliver_to_address` TEXT NULL AFTER `deliver_to_name`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'payment_terms') = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `payment_terms` VARCHAR(120) NULL AFTER `deliver_to_address`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'terms_conditions') = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `terms_conditions` TEXT NULL AFTER `notes`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'vendor_gstin') = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `vendor_gstin` VARCHAR(30) NULL AFTER `vendor_state`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'gst_treatment') = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `gst_treatment` VARCHAR(80) NULL AFTER `vendor_gstin`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'reverse_charge') = 0,
  'ALTER TABLE `purchase_orders` ADD COLUMN `reverse_charge` TINYINT(1) NOT NULL DEFAULT 0 AFTER `gst_treatment`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'purchase_orders' AND INDEX_NAME = 'idx_purchase_orders_reference_number') = 0,
  'ALTER TABLE `purchase_orders` ADD INDEX `idx_purchase_orders_reference_number` (`reference_number`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
