-- AMC contract start: the day the contract began. start_date moves on a
-- year at each renewal; contract_start stays, so the app can tell whether a
-- contract is still in its first year, when the first-year answers (from the
-- 1st or 2nd year, paid or not) can still be changed.
-- Idempotent: the column is added only when missing, and filled where empty.

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_amc_records' AND COLUMN_NAME = 'contract_start'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_amc_records` ADD COLUMN `contract_start` DATE NULL AFTER `term_paid`',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE ops_amc_records SET contract_start = start_date WHERE contract_start IS NULL;
