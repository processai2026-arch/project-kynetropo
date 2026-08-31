-- Phase 2 / Module 05: HR compliance, TMS attendance imports, and meeting media.
-- Run after create_attachments.sql. import_jobs is reconciled separately, so
-- import_job_id deliberately has no cross-module foreign key.

CREATE TABLE IF NOT EXISTS `employee_compliance` (
  `compliance_id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_key` varchar(12) NOT NULL,
  `type` varchar(30) NOT NULL,
  `provider` varchar(120) DEFAULT NULL,
  `policy_number` varchar(80) DEFAULT NULL,
  `coverage_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `premium` decimal(14,2) NOT NULL DEFAULT 0.00,
  `start_date` date DEFAULT NULL,
  `expiry_date` date NOT NULL,
  `status` varchar(12) NOT NULL DEFAULT 'active',
  `attachment_id` int(11) DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`compliance_id`),
  KEY `idx_emp_compliance_employee` (`employee_key`),
  KEY `idx_emp_compliance_status_expiry` (`status`, `expiry_date`),
  KEY `idx_emp_compliance_type` (`type`),
  KEY `idx_emp_compliance_attachment` (`attachment_id`),
  CONSTRAINT `fk_emp_compliance_employee`
    FOREIGN KEY (`employee_key`) REFERENCES `employees` (`employee_key`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_emp_compliance_attachment`
    FOREIGN KEY (`attachment_id`) REFERENCES `attachments` (`attachment_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `attendance_punches` (
  `punch_id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_key` varchar(12) NOT NULL,
  `punch_timestamp` datetime NOT NULL,
  `direction` varchar(10) NOT NULL DEFAULT 'unknown',
  `external_punch_id` varchar(120) DEFAULT NULL,
  `import_job_id` int(11) DEFAULT NULL,
  `raw_json` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'imported',
  `error_text` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`punch_id`),
  UNIQUE KEY `uq_att_punch_emp_ts_dir` (`employee_key`, `punch_timestamp`, `direction`),
  UNIQUE KEY `uq_att_punch_external` (`external_punch_id`),
  KEY `idx_att_punch_job` (`import_job_id`),
  KEY `idx_att_punch_employee_day` (`employee_key`, `punch_timestamp`),
  CONSTRAINT `fk_att_punch_employee`
    FOREIGN KEY (`employee_key`) REFERENCES `employees` (`employee_key`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'attachments' AND COLUMN_NAME = 'caption') = 0,
  'ALTER TABLE `attachments` ADD COLUMN `caption` VARCHAR(255) DEFAULT NULL AFTER `category`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'attachments' AND COLUMN_NAME = 'thumbnail_path') = 0,
  'ALTER TABLE `attachments` ADD COLUMN `thumbnail_path` VARCHAR(500) DEFAULT NULL AFTER `file_path`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'attachments' AND COLUMN_NAME = 'metadata_json') = 0,
  'ALTER TABLE `attachments` ADD COLUMN `metadata_json` TEXT DEFAULT NULL AFTER `storage_disk`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'source' AND COLUMN_TYPE LIKE '%''tms''%') = 0,
  'ALTER TABLE `attendance` MODIFY COLUMN `source` ENUM(''manual'',''qr'',''auto'',''tms'') NOT NULL DEFAULT ''manual''',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
