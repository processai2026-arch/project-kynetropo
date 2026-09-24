CREATE TABLE IF NOT EXISTS ops_bugs (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id      INT UNSIGNED NOT NULL DEFAULT 1,
  project_id     INT UNSIGNED NOT NULL,
  module         VARCHAR(100) NOT NULL DEFAULT '',
  description    TEXT NOT NULL,
  type           ENUM('bug','feature_request','change_request') NOT NULL DEFAULT 'bug',
  priority       ENUM('p0_critical','p1_high','p2_medium','p3_low') NOT NULL DEFAULT 'p2_medium',
  reported_by    VARCHAR(100) NOT NULL DEFAULT '',
  developer_id   INT UNSIGNED DEFAULT NULL,
  qa_id          INT UNSIGNED DEFAULT NULL,
  status         ENUM('open','in_progress','fixed','retest','closed','wont_fix') NOT NULL DEFAULT 'open',
  target_date    DATE DEFAULT NULL,
  steps_to_repro TEXT,
  parent_bug_id  INT UNSIGNED DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_project (project_id),
  INDEX idx_status (status),
  INDEX idx_developer (developer_id),
  INDEX idx_qa (qa_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ops_bug_screenshots (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  bug_id      INT UNSIGNED NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  uploaded_by VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bug (bug_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ops_bug_comments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  bug_id      INT UNSIGNED NOT NULL,
  comment     TEXT NOT NULL,
  added_by    VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bug (bug_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
