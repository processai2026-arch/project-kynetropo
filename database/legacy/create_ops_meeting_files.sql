CREATE TABLE IF NOT EXISTS ops_meeting_files (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  entity_type  ENUM('meeting','followup') NOT NULL DEFAULT 'meeting',
  entity_id    INT UNSIGNED NOT NULL,
  file_name    VARCHAR(300) NOT NULL,
  file_path    VARCHAR(500) NOT NULL,
  file_type    ENUM('voice','document') NOT NULL DEFAULT 'document',
  mime_type    VARCHAR(100) DEFAULT NULL,
  uploaded_by  VARCHAR(100) NOT NULL DEFAULT '',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (tenant_id, entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
