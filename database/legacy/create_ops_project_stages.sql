CREATE TABLE IF NOT EXISTS ops_project_stages (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  project_id   INT UNSIGNED NOT NULL,
  stage_name   VARCHAR(80)  NOT NULL,
  completed_by VARCHAR(100) NOT NULL DEFAULT '',
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes        TEXT,
  INDEX idx_project (project_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
