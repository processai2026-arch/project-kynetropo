CREATE TABLE IF NOT EXISTS ops_payments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  client_id    INT UNSIGNED NOT NULL,
  project_id   INT UNSIGNED NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  type         ENUM('advance','mid','final','amc','other') NOT NULL DEFAULT 'advance',
  mode         ENUM('cash','bank_transfer','upi','cheque','other') NOT NULL DEFAULT 'bank_transfer',
  reference    VARCHAR(200) DEFAULT NULL,
  recorded_by  VARCHAR(100) NOT NULL DEFAULT '',
  payment_date DATE NOT NULL,
  notes        TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_client (client_id),
  INDEX idx_project (project_id),
  INDEX idx_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ops_expenses (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  category    ENUM('hosting','tools','travel','marketing','salary','pitch','other') NOT NULL DEFAULT 'other',
  amount      DECIMAL(12,2) NOT NULL,
  description TEXT,
  project_id  INT UNSIGNED DEFAULT NULL,
  pitch_id    INT UNSIGNED DEFAULT NULL,
  date        DATE NOT NULL,
  added_by    VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_category (category),
  INDEX idx_date (date),
  INDEX idx_project (project_id),
  INDEX idx_pitch (pitch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
