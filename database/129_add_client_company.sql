-- Client company: ops_clients.name is the person the team deals with
-- (Mukunthan K), company is their business (EcoSudar). Optional.
-- Idempotent: the column is added only when missing.

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_clients' AND COLUMN_NAME = 'company'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_clients` ADD COLUMN `company` VARCHAR(200) NOT NULL DEFAULT \'\' AFTER `name`',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;
