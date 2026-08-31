-- Phase 2 / Module 06: backup run metadata for data interoperability health.

CREATE TABLE IF NOT EXISTS `backup_runs` (
  `backup_id` int(11) NOT NULL AUTO_INCREMENT,
  `backup_type` varchar(20) NOT NULL DEFAULT 'database',
  `file_path` varchar(500) DEFAULT NULL,
  `size_bytes` bigint DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'running',
  `started_at` datetime NOT NULL DEFAULT current_timestamp(),
  `finished_at` datetime DEFAULT NULL,
  `error_text` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`backup_id`),
  KEY `idx_backup_runs_status` (`status`),
  KEY `idx_backup_runs_started` (`started_at`),
  CONSTRAINT `fk_backup_runs_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
