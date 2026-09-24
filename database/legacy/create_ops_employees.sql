CREATE TABLE IF NOT EXISTS ops_employees (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  name         VARCHAR(200) NOT NULL,
  phone        VARCHAR(30)  NOT NULL DEFAULT '',
  email        VARCHAR(200) NOT NULL DEFAULT '',
  role         ENUM('founder','qa_tester','sales_caller','trainer','developer','other') NOT NULL DEFAULT 'other',
  access_level ENUM('full','bugs_only','clients_readonly','clients_followups') NOT NULL DEFAULT 'clients_readonly',
  monthly_pay  DECIMAL(10,2) NOT NULL DEFAULT 0,
  start_date   DATE DEFAULT NULL,
  status       ENUM('active','inactive') NOT NULL DEFAULT 'active',
  notes        TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
