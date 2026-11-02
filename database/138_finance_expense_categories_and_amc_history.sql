-- Expenses with your own categories and notes; AMC payments that know their year.
--
-- ops_expenses.category: was a fixed list (hosting, tools, travel, marketing,
--   salary, pitch, other); now any category, so a new one ("Office rent") can
--   be added from the expense form. The old values stay as they are.
-- ops_expenses.notes: anything more about the expense, beside its description.
-- ops_payments.amc_id / amc_from / amc_to: the AMC a payment paid and the year
--   it paid for, so an AMC page can list each year's payment.
-- ops_payments.amc_prev: the AMC as it was before this payment was collected
--   (JSON), so a collection can be reverted exactly: the payment goes, and the
--   AMC's year, renewal and paid state go back to what they were.
-- Existing AMC payments: linked to their AMC (the one it is the current payment
--   of, else the project's AMC), and their year read from the reference the app
--   wrote ("AMC 2026-04-01 to 2027-04-01") or the AMC's current year.
-- Idempotent: each column is added only when missing.

SET @c_type = (
  SELECT DATA_TYPE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_expenses' AND COLUMN_NAME = 'category'
);
SET @c_sql = IF(@c_type = 'enum',
  'ALTER TABLE `ops_expenses` MODIFY COLUMN `category` VARCHAR(60) NOT NULL DEFAULT ''other''',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_expenses' AND COLUMN_NAME = 'notes'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_expenses` ADD COLUMN `notes` TEXT NULL AFTER `description`',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_payments' AND COLUMN_NAME = 'amc_id'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_payments`
     ADD COLUMN `amc_id`   INT UNSIGNED NULL,
     ADD COLUMN `amc_from` DATE NULL,
     ADD COLUMN `amc_to`   DATE NULL,
     ADD COLUMN `amc_prev` TEXT NULL,
     ADD INDEX `idx_pay_amc` (`tenant_id`, `amc_id`)',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;

-- The AMC's current payment: its AMC and its year.
UPDATE `ops_payments` p
  JOIN `ops_amc_records` a ON a.payment_id = p.id AND a.tenant_id = p.tenant_id
   SET p.amc_id = a.id, p.amc_from = a.start_date, p.amc_to = a.renewal_date
 WHERE p.amc_id IS NULL;

-- Other AMC payments: the project's (first) AMC.
UPDATE `ops_payments` p
  JOIN (SELECT tenant_id, project_id, MIN(id) AS amc_id FROM `ops_amc_records` GROUP BY tenant_id, project_id) a
    ON a.project_id = p.project_id AND a.tenant_id = p.tenant_id
   SET p.amc_id = a.amc_id
 WHERE p.type = 'amc' AND p.amc_id IS NULL;

-- Their year, from the reference the app wrote.
UPDATE `ops_payments`
   SET amc_from = STR_TO_DATE(SUBSTRING(reference, 5, 10), '%Y-%m-%d'),
       amc_to   = STR_TO_DATE(SUBSTRING(reference, 19, 10), '%Y-%m-%d')
 WHERE type = 'amc' AND amc_from IS NULL
   AND reference REGEXP '^AMC [0-9]{4}-[0-9]{2}-[0-9]{2} to [0-9]{4}-[0-9]{2}-[0-9]{2}$';
