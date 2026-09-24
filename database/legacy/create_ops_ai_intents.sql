CREATE TABLE IF NOT EXISTS ops_ai_intents (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  token       VARCHAR(64)  NOT NULL,
  intent_type VARCHAR(50)  NOT NULL,
  payload     JSON         NOT NULL,
  preview     TEXT         NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY  uk_ai_intent_token (token),
  INDEX       idx_ai_intents_tenant (tenant_id),
  INDEX       idx_ai_intents_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
