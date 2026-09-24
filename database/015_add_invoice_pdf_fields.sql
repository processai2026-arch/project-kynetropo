-- Adds the PDF-detail fields to invoices so they can be edited inside the
-- Edit Invoice dialog and saved (replacing the old "Prepare Template PDF" popup).
-- When any column is left blank, the PDF falls back to the auto-generated value.
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'invoice_date') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `invoice_date` DATE NULL AFTER `due_date`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'payment_terms') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `payment_terms` VARCHAR(100) NULL AFTER `invoice_date`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'place_of_supply') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `place_of_supply` VARCHAR(100) NULL AFTER `payment_terms`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'ship_to') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `ship_to` TEXT NULL AFTER `place_of_supply`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'subject') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `subject` VARCHAR(255) NULL AFTER `ship_to`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
