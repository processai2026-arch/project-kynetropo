-- Add invoice-level discount to invoices table.
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'discount') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `delivery_fee`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
