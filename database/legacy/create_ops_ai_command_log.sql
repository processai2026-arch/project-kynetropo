CREATE TABLE IF NOT EXISTS ops_ai_command_log (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  raw_prompt   TEXT         NOT NULL,
  intent_type  VARCHAR(50)  DEFAULT NULL,
  payload      JSON         DEFAULT NULL,
  executed     TINYINT(1)   NOT NULL DEFAULT 0,
  error        TEXT         DEFAULT NULL,
  executed_by  VARCHAR(100) NOT NULL DEFAULT '',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX        idx_ai_log_tenant (tenant_id),
  INDEX        idx_ai_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
