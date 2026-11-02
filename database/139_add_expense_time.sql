-- The time of day an expense was paid, beside its date. Optional: an expense
-- imported from a file that has no times (Money Manager) keeps it empty.
-- Idempotent: the column is added only when missing.

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_expenses' AND COLUMN_NAME = 'expense_time'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_expenses` ADD COLUMN `expense_time` TIME NULL AFTER `date`',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;
