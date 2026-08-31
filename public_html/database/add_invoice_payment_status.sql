-- Gives invoices their own payment status so manually-created invoices (no order)
-- can be marked Paid/Unpaid. For order-linked invoices it stays NULL and falls
-- back to the order's payment_status (same linking pattern as payment_method).
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'payment_status') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `payment_status` VARCHAR(20) NULL AFTER `payment_method`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
