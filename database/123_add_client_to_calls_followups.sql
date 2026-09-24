-- Calls and follow-ups can belong to a CLIENT, not only to a lead.
--
-- Both tables were written when every customer arrived as a lead and was
-- converted. That is not how this database looks: clients are created straight
-- in the admin dashboard and never had a lead behind them, so there was no way
-- to book a follow-up on a customer you already have — only on one you are
-- still chasing.
--
-- lead_id therefore becomes nullable and client_id joins it. Exactly one of the
-- two is ever set. That rule is enforced in the controllers rather than as a
-- CHECK constraint, so it holds the same way on every engine this schema is
-- expected to run on -- and so a violation comes back as a 422 the caller can
-- read instead of a driver error.
--
-- Nothing existing changes: every current row keeps its lead_id and gets a NULL
-- client_id.
--
-- Idempotent: safe to re-run, and registered in migrate.php.

-- ── sales_followups.client_id ───────────────────────────────────────────────
SET @f_client_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_followups' AND COLUMN_NAME = 'client_id'
);
SET @f_client_sql = IF(@f_client_exists = 0,
  'ALTER TABLE `sales_followups` ADD COLUMN `client_id` INT UNSIGNED DEFAULT NULL AFTER `lead_id`',
  'SELECT 1');
PREPARE s FROM @f_client_sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @f_client_idx = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_followups' AND INDEX_NAME = 'idx_sf_client'
);
SET @f_client_idx_sql = IF(@f_client_idx = 0,
  'CREATE INDEX `idx_sf_client` ON `sales_followups` (`tenant_id`, `client_id`)',
  'SELECT 1');
PREPARE s FROM @f_client_idx_sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── sales_followups.lead_id becomes nullable ────────────────────────────────
SET @f_lead_nullable = (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_followups' AND COLUMN_NAME = 'lead_id'
);
SET @f_lead_sql = IF(@f_lead_nullable = 'NO',
  'ALTER TABLE `sales_followups` MODIFY COLUMN `lead_id` INT UNSIGNED DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @f_lead_sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── sales_calls.client_id ───────────────────────────────────────────────────
SET @c_client_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_calls' AND COLUMN_NAME = 'client_id'
);
SET @c_client_sql = IF(@c_client_exists = 0,
  'ALTER TABLE `sales_calls` ADD COLUMN `client_id` INT UNSIGNED DEFAULT NULL AFTER `lead_id`',
  'SELECT 1');
PREPARE s FROM @c_client_sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c_client_idx = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_calls' AND INDEX_NAME = 'idx_sc_client'
);
SET @c_client_idx_sql = IF(@c_client_idx = 0,
  'CREATE INDEX `idx_sc_client` ON `sales_calls` (`tenant_id`, `client_id`)',
  'SELECT 1');
PREPARE s FROM @c_client_idx_sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── sales_calls.lead_id becomes nullable ────────────────────────────────────
SET @c_lead_nullable = (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_calls' AND COLUMN_NAME = 'lead_id'
);
SET @c_lead_sql = IF(@c_lead_nullable = 'NO',
  'ALTER TABLE `sales_calls` MODIFY COLUMN `lead_id` INT UNSIGNED DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @c_lead_sql; EXECUTE s; DEALLOCATE PREPARE s;
