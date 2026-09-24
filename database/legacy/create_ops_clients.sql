CREATE TABLE IF NOT EXISTS ops_clients (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT UNSIGNED NOT NULL DEFAULT 1,
  name          VARCHAR(200) NOT NULL,
  phone         VARCHAR(30)  NOT NULL DEFAULT '',
  email         VARCHAR(200) NOT NULL DEFAULT '',
  source        VARCHAR(200) NOT NULL DEFAULT '',
  source_pitch_id INT UNSIGNED DEFAULT NULL,
  owner         VARCHAR(100) NOT NULL DEFAULT '',
  health        ENUM('green','yellow','red') NOT NULL DEFAULT 'green',
  stage         VARCHAR(80)  NOT NULL DEFAULT 'First Meetup',
  notes         TEXT,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_stage (stage),
  INDEX idx_source_pitch (source_pitch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
