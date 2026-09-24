-- ─── Ops SOP Files ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ops_sop_files (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  sop_id       INT UNSIGNED NOT NULL,
  file_path    VARCHAR(500) NOT NULL,
  file_name    VARCHAR(300) NOT NULL,
  version_no   INT UNSIGNED NOT NULL DEFAULT 1,
  uploaded_by  VARCHAR(100) NOT NULL DEFAULT '',
  uploaded_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_sop (tenant_id, sop_id),
  FOREIGN KEY (sop_id) REFERENCES ops_sops(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
