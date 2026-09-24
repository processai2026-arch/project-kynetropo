CREATE TABLE IF NOT EXISTS ops_document_checklist (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id      INT UNSIGNED NOT NULL DEFAULT 1,
  client_id      INT UNSIGNED NOT NULL,
  item_name      VARCHAR(200) NOT NULL,
  is_done        TINYINT(1) NOT NULL DEFAULT 0,
  completed_date DATE DEFAULT NULL,
  file_path      VARCHAR(500) DEFAULT NULL,
  completed_by   VARCHAR(100) DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
