-- Component Library (Operations module) — predefined spec components the
-- Quotation Builder can reuse when composing line-item component lists.
-- Idempotent: safe to re-run. tenant_id included so the migrate tenant pass is happy.

CREATE TABLE IF NOT EXISTS component_library (
  component_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id     INT NOT NULL DEFAULT 1,
  name          VARCHAR(255) NOT NULL,
  make          VARCHAR(120) NULL,
  default_unit  VARCHAR(40) NULL,
  default_qty   DECIMAL(12,2) NOT NULL DEFAULT 1,
  category      VARCHAR(120) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (component_id),
  KEY idx_cl_tenant (tenant_id),
  KEY idx_cl_name (tenant_id, name, make)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
