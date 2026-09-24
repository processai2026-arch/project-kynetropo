-- Client ID and Project ID: ops_clients.client_code (CL-0001) and
-- ops_projects.project_code (PRJ-0001).
--
-- Existing rows are numbered oldest to newest (created_at, then id), per
-- tenant, continuing after the highest number already in use. New records get
-- the next number from the API (api/services/OpsCodes.php). Both stay editable;
-- a UNIQUE key per tenant keeps two records from sharing one.
--
-- Idempotent: columns and keys are added only when missing, and only rows
-- without a code are numbered.

-- ── Columns ─────────────────────────────────────────────────────────────────
SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_clients' AND COLUMN_NAME = 'client_code'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `ops_clients` ADD COLUMN `client_code` VARCHAR(30) DEFAULT NULL AFTER `tenant_id`',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @p_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_projects' AND COLUMN_NAME = 'project_code'
);
SET @p_sql = IF(@p_exists = 0,
  'ALTER TABLE `ops_projects` ADD COLUMN `project_code` VARCHAR(30) DEFAULT NULL AFTER `tenant_id`',
  'SELECT 1');
PREPARE s FROM @p_sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ── Number the rows that have no code, oldest first ─────────────────────────
DROP TEMPORARY TABLE IF EXISTS tmp_client_codes;
CREATE TEMPORARY TABLE tmp_client_codes AS
SELECT x.id,
       CONCAT('CL-', LPAD(
         ROW_NUMBER() OVER (PARTITION BY x.tenant_id ORDER BY x.created_at, x.id)
         + COALESCE((SELECT MAX(CAST(SUBSTRING(y.client_code, 4) AS UNSIGNED))
                       FROM ops_clients y
                      WHERE y.tenant_id = x.tenant_id AND y.client_code REGEXP '^CL-[0-9]+$'), 0),
         4, '0')) AS code
  FROM ops_clients x
 WHERE x.client_code IS NULL OR x.client_code = '';
UPDATE ops_clients c JOIN tmp_client_codes t ON t.id = c.id SET c.client_code = t.code;
DROP TEMPORARY TABLE IF EXISTS tmp_client_codes;

DROP TEMPORARY TABLE IF EXISTS tmp_project_codes;
CREATE TEMPORARY TABLE tmp_project_codes AS
SELECT x.id,
       CONCAT('PRJ-', LPAD(
         ROW_NUMBER() OVER (PARTITION BY x.tenant_id ORDER BY x.created_at, x.id)
         + COALESCE((SELECT MAX(CAST(SUBSTRING(y.project_code, 5) AS UNSIGNED))
                       FROM ops_projects y
                      WHERE y.tenant_id = x.tenant_id AND y.project_code REGEXP '^PRJ-[0-9]+$'), 0),
         4, '0')) AS code
  FROM ops_projects x
 WHERE x.project_code IS NULL OR x.project_code = '';
UPDATE ops_projects p JOIN tmp_project_codes t ON t.id = p.id SET p.project_code = t.code;
DROP TEMPORARY TABLE IF EXISTS tmp_project_codes;

-- ── One code per record, per tenant ─────────────────────────────────────────
SET @cu_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_clients' AND INDEX_NAME = 'uq_ops_clients_code'
);
SET @cu_sql = IF(@cu_exists = 0,
  'ALTER TABLE `ops_clients` ADD UNIQUE KEY `uq_ops_clients_code` (`tenant_id`, `client_code`)',
  'SELECT 1');
PREPARE s FROM @cu_sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @pu_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_projects' AND INDEX_NAME = 'uq_ops_projects_code'
);
SET @pu_sql = IF(@pu_exists = 0,
  'ALTER TABLE `ops_projects` ADD UNIQUE KEY `uq_ops_projects_code` (`tenant_id`, `project_code`)',
  'SELECT 1');
PREPARE s FROM @pu_sql; EXECUTE s; DEALLOCATE PREPARE s;
