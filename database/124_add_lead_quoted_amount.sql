-- Leads carry a quote.
--
-- The money lived only on ops_projects.quoted, which exists once a lead has
-- become a client with a project. A deal being discussed but not yet won had
-- nowhere to record what was quoted for it -- and when a client is moved back
-- to the pipeline, the figure that was already agreed had nowhere to land.
--
-- NULL is deliberate and different from 0: "nothing has been quoted yet" is not
-- the same fact as "quoted zero", and a screen that shows the first as a price
-- is simply wrong.
--
-- Idempotent: safe to re-run, and registered in migrate.php.

SET @lead_quote_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_leads' AND COLUMN_NAME = 'quoted_amount'
);
SET @lead_quote_sql = IF(@lead_quote_exists = 0,
  'ALTER TABLE `sales_leads` ADD COLUMN `quoted_amount` DECIMAL(12,2) DEFAULT NULL AFTER `switch_reason`',
  'SELECT 1');
PREPARE s FROM @lead_quote_sql; EXECUTE s; DEALLOCATE PREPARE s;
