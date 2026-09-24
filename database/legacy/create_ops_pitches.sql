CREATE TABLE IF NOT EXISTS ops_pitches (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  name        VARCHAR(200) NOT NULL,
  date        DATE NOT NULL,
  venue       VARCHAR(200) DEFAULT NULL,
  city        VARCHAR(100) DEFAULT NULL,
  type        ENUM('yes_meeting','business_forum','cold_outreach','referral_event','online','other') NOT NULL DEFAULT 'yes_meeting',
  spend       DECIMAL(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_by  VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
