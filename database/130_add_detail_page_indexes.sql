-- Indexes for the joins and filters the detail pages and dashboard run:
-- a client's meetings and AMC records, a project's payments and expenses,
-- a bug's comments and screenshots, and the activity/file lookups by entity.
-- The data is small today; these keep those pages fast as it grows.
--
-- Idempotent: each index is added only when its table and columns exist and
-- no index of that name is there yet.

SET @ok = (SELECT COUNT(*) = 3 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_activity_log' AND COLUMN_NAME IN ('tenant_id', 'entity_type', 'entity_id'))
      AND (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_activity_log' AND INDEX_NAME = 'idx_oal_entity');
SET @q = IF(@ok, 'ALTER TABLE `ops_activity_log` ADD INDEX `idx_oal_entity` (`tenant_id`, `entity_type`, `entity_id`)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @ok = (SELECT COUNT(*) = 3 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_meeting_files' AND COLUMN_NAME IN ('tenant_id', 'entity_type', 'entity_id'))
      AND (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_meeting_files' AND INDEX_NAME = 'idx_omf_entity');
SET @q = IF(@ok, 'ALTER TABLE `ops_meeting_files` ADD INDEX `idx_omf_entity` (`tenant_id`, `entity_type`, `entity_id`)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @ok = (SELECT COUNT(*) = 2 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_payments' AND COLUMN_NAME IN ('tenant_id', 'project_id'))
      AND (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_payments' AND INDEX_NAME = 'idx_opay_project');
SET @q = IF(@ok, 'ALTER TABLE `ops_payments` ADD INDEX `idx_opay_project` (`tenant_id`, `project_id`)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @ok = (SELECT COUNT(*) = 2 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_meetings' AND COLUMN_NAME IN ('tenant_id', 'client_id'))
      AND (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_meetings' AND INDEX_NAME = 'idx_omeet_client');
SET @q = IF(@ok, 'ALTER TABLE `ops_meetings` ADD INDEX `idx_omeet_client` (`tenant_id`, `client_id`)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @ok = (SELECT COUNT(*) = 2 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_meetings' AND COLUMN_NAME IN ('tenant_id', 'project_id'))
      AND (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_meetings' AND INDEX_NAME = 'idx_omeet_project');
SET @q = IF(@ok, 'ALTER TABLE `ops_meetings` ADD INDEX `idx_omeet_project` (`tenant_id`, `project_id`)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @ok = (SELECT COUNT(*) = 2 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_amc_records' AND COLUMN_NAME IN ('tenant_id', 'client_id'))
      AND (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_amc_records' AND INDEX_NAME = 'idx_oamc_client');
SET @q = IF(@ok, 'ALTER TABLE `ops_amc_records` ADD INDEX `idx_oamc_client` (`tenant_id`, `client_id`)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @ok = (SELECT COUNT(*) = 2 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_amc_records' AND COLUMN_NAME IN ('tenant_id', 'project_id'))
      AND (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_amc_records' AND INDEX_NAME = 'idx_oamc_project');
SET @q = IF(@ok, 'ALTER TABLE `ops_amc_records` ADD INDEX `idx_oamc_project` (`tenant_id`, `project_id`)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @ok = (SELECT COUNT(*) = 2 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_bug_comments' AND COLUMN_NAME IN ('tenant_id', 'bug_id'))
      AND (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_bug_comments' AND INDEX_NAME = 'idx_obc_bug');
SET @q = IF(@ok, 'ALTER TABLE `ops_bug_comments` ADD INDEX `idx_obc_bug` (`tenant_id`, `bug_id`)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @ok = (SELECT COUNT(*) = 1 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_bug_screenshots' AND COLUMN_NAME IN ('bug_id'))
      AND (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_bug_screenshots' AND INDEX_NAME = 'idx_obs_bug');
SET @q = IF(@ok, 'ALTER TABLE `ops_bug_screenshots` ADD INDEX `idx_obs_bug` (`bug_id`)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

SET @ok = (SELECT COUNT(*) = 2 FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_expenses' AND COLUMN_NAME IN ('tenant_id', 'project_id'))
      AND (SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ops_expenses' AND INDEX_NAME = 'idx_oexp_project');
SET @q = IF(@ok, 'ALTER TABLE `ops_expenses` ADD INDEX `idx_oexp_project` (`tenant_id`, `project_id`)', 'SELECT 1');
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
