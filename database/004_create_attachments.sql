CREATE TABLE IF NOT EXISTS `attachments` (
  `attachment_id` int(11) NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(40) NOT NULL,
  `entity_id` int(11) NOT NULL,
  `category` varchar(40) DEFAULT NULL,
  `file_path` varchar(500) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `size_bytes` int(11) DEFAULT NULL,
  `storage_disk` enum('local','external') NOT NULL DEFAULT 'local',
  `uploaded_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`attachment_id`),
  KEY `idx_attach_entity` (`entity_type`, `entity_id`),
  KEY `idx_attach_uploaded_by` (`uploaded_by`),
  KEY `idx_attach_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
