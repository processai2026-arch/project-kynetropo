CREATE TABLE IF NOT EXISTS `import_jobs` (
  `job_id` int(11) NOT NULL AUTO_INCREMENT,
  `module` varchar(40) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `total_rows` int(11) NOT NULL DEFAULT 0,
  `valid_rows` int(11) NOT NULL DEFAULT 0,
  `error_rows` int(11) NOT NULL DEFAULT 0,
  `mapping_json` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`job_id`),
  KEY `idx_import_jobs_module` (`module`),
  KEY `idx_import_jobs_status` (`status`),
  KEY `idx_import_jobs_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `import_job_rows` (
  `row_id` int(11) NOT NULL AUTO_INCREMENT,
  `job_id` int(11) NOT NULL,
  `row_number` int(11) NOT NULL,
  `raw_json` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `error_text` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`row_id`),
  KEY `idx_import_rows_job` (`job_id`, `status`),
  CONSTRAINT `fk_import_rows_job`
    FOREIGN KEY (`job_id`) REFERENCES `import_jobs` (`job_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
