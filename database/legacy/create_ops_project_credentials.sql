CREATE TABLE IF NOT EXISTS ops_project_credentials (
  id            INT          NOT NULL AUTO_INCREMENT,
  tenant_id     INT          NOT NULL DEFAULT 1,
  project_id    INT          NOT NULL,
  label         VARCHAR(100) NOT NULL,
  role          VARCHAR(100) NOT NULL DEFAULT '',
  username      VARCHAR(255) NOT NULL DEFAULT '',
  password      VARCHAR(500) NOT NULL DEFAULT '',
  url           VARCHAR(500) NOT NULL DEFAULT '',
  notes         TEXT         DEFAULT NULL,
  created_by    VARCHAR(100) NOT NULL DEFAULT '',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ops_creds_project (project_id),
  INDEX idx_ops_creds_tenant  (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
