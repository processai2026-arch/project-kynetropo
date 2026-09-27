-- AMC first year: whether the first year's maintenance is free (included
-- with the project) and whether the current year is paid for.
--
--   first_year_free  1 = nothing is charged for the first year; the yearly
--                    amount is first due on renewal_date.
--   term_paid        1 = the current year (start_date to renewal_date) is paid
--                    for, or is the free first year, so the next payment is due
--                    on renewal_date. 0 = it is not paid yet, so the amount is
--                    due from start_date.
--
-- Existing records keep their meaning: they were made with the renewal a year
-- out, so they count as paid for (term_paid defaults to 1).
-- Idempotent: each column is added only when missing.

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_amc_records' AND COLUMN_NAME = 'first_year_free'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_amc_records` ADD COLUMN `first_year_free` TINYINT(1) NOT NULL DEFAULT 0 AFTER `amount`',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_amc_records' AND COLUMN_NAME = 'term_paid'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_amc_records` ADD COLUMN `term_paid` TINYINT(1) NOT NULL DEFAULT 1 AFTER `first_year_free`',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;
