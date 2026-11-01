-- AMC priced by users and storage use.
--
-- ops_amc_records.base_amount: the base price a year. `amount` stays the yearly
--   price everything reads (Finance, the dashboard's AMC due, renewals), and is
--   now the base plus what the extra users and storage add.
-- ops_amc_records.user_plans: per category (ERP, Web APK…), the users the base
--   covers, the extra users that make one block (1, or 5…), the block's price a
--   year, and how many users there are now — JSON, a list of
--   {category, included, step, price, users}.
-- ops_amc_records.storage_used_gb: the storage in use now, against storage_gb.
-- Existing AMCs: base_amount = amount, no users, nothing used — the price is unchanged.
-- Idempotent: each column is added only when missing.

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_amc_records' AND COLUMN_NAME = 'base_amount'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_amc_records`
     ADD COLUMN `base_amount`     DECIMAL(12,2) NULL AFTER `amount`,
     ADD COLUMN `user_plans`      TEXT          NULL AFTER `storage_step_price`,
     ADD COLUMN `storage_used_gb` DECIMAL(10,2) NULL AFTER `user_plans`',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `ops_amc_records` SET `base_amount` = `amount` WHERE `base_amount` IS NULL;
