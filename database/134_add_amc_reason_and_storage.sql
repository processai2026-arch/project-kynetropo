-- AMC reason and storage.
--
-- ops_projects.amc_reason: why the project has the AMC it has — why no AMC
--   (offline setup, installation cost paid offline…), or why it is charged from
--   the 1st or the 2nd year. Kept on the project because "no AMC" has no AMC row.
-- ops_amc_records.storage_*: the storage the base AMC price includes, and what
--   each extra block costs a year (e.g. 20 GB in ₹4,000; every 10 GB more, ₹500).
-- Idempotent: each column is added only when missing.

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_projects' AND COLUMN_NAME = 'amc_reason'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_projects` ADD COLUMN `amc_reason` VARCHAR(300) NOT NULL DEFAULT ''''',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_amc_records' AND COLUMN_NAME = 'storage_gb'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_amc_records`
     ADD COLUMN `storage_gb`         DECIMAL(10,2) NULL AFTER `amount`,
     ADD COLUMN `storage_step_gb`    DECIMAL(10,2) NULL AFTER `storage_gb`,
     ADD COLUMN `storage_step_price` DECIMAL(12,2) NULL AFTER `storage_step_gb`',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;
