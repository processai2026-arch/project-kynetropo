-- Add per-line unit of measure to invoice_items (kg, ton, bags, Nos, etc.).
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoice_items' AND COLUMN_NAME = 'unit') = 0,
  'ALTER TABLE `invoice_items` ADD COLUMN `unit` VARCHAR(20) NOT NULL DEFAULT ''Nos'' AFTER `quantity`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
