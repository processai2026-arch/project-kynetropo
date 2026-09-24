CREATE TABLE IF NOT EXISTS ops_activity_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   INT UNSIGNED NOT NULL,
  action      VARCHAR(100) NOT NULL,
  description TEXT,
  done_by     VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ops_activity_comments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  activity_id INT UNSIGNED NOT NULL,
  comment     TEXT NOT NULL,
  added_by    VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity (activity_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
