-- History of every current_work and next_action edit on a project
CREATE TABLE IF NOT EXISTS ops_project_notes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  project_id  INT UNSIGNED NOT NULL,
  field       ENUM('current_work','next_action') NOT NULL,
  note        TEXT NOT NULL,
  due_date    DATE DEFAULT NULL,
  saved_by    VARCHAR(100) NOT NULL DEFAULT '',
  saved_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_project (tenant_id, project_id),
  FOREIGN KEY (project_id) REFERENCES ops_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
