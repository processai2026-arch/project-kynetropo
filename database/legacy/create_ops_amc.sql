CREATE TABLE IF NOT EXISTS ops_amc_records (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  client_id    INT UNSIGNED NOT NULL,
  project_id   INT UNSIGNED NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  start_date   DATE NOT NULL,
  renewal_date DATE NOT NULL,
  status       ENUM('active','due','overdue','paid') NOT NULL DEFAULT 'active',
  payment_mode VARCHAR(50) DEFAULT NULL,
  payment_id   INT UNSIGNED DEFAULT NULL,
  notes        TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_client (client_id),
  INDEX idx_renewal (renewal_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
