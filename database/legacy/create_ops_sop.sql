-- ─── Ops SOP Module ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ops_sop_modules (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  name        VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  position    INT UNSIGNED NOT NULL DEFAULT 0,
  created_by  VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_sops (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  module_id   INT UNSIGNED NOT NULL,
  title       VARCHAR(300) NOT NULL,
  content     LONGTEXT DEFAULT NULL,
  position    INT UNSIGNED NOT NULL DEFAULT 0,
  created_by  VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_module (tenant_id, module_id),
  FOREIGN KEY (module_id) REFERENCES ops_sop_modules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_sop_versions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  sop_id      INT UNSIGNED NOT NULL,
  version_no  INT UNSIGNED NOT NULL DEFAULT 1,
  title       VARCHAR(300) NOT NULL,
  content     LONGTEXT DEFAULT NULL,
  saved_by    VARCHAR(100) NOT NULL DEFAULT '',
  saved_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_sop (tenant_id, sop_id),
  FOREIGN KEY (sop_id) REFERENCES ops_sops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- seed one starter module
INSERT INTO ops_sop_modules (tenant_id, name, description, position, created_by)
VALUES (1, 'Onboarding', 'Client onboarding SOPs', 1, 'Founder');
