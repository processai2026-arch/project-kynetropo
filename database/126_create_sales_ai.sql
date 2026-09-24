-- ============================================================================
-- Sales AI Assistant — conversation memory, single-use confirm tokens, audit.
--
-- The assistant does two things:
--   READ  — answers questions from live, tenant-scoped data (no model SQL).
--   WRITE — proposes an action (add lead / follow-up / meeting / call), which
--           becomes a single-use, expiring token and only runs after the user
--           confirms. The write is replayed through the real REST API with the
--           caller's own JWT, so every permission check applies to the AI too.
--
-- MEMORY lives here, not in the browser, so a thread survives a tab switch and
-- an executed write can be traced back to the words that asked for it.
--
-- Tenant-scoped and idempotent (CREATE TABLE IF NOT EXISTS): safe to re-run,
-- register in database/migrate.php with the other feature schemas.
-- ============================================================================

-- Threads --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_ai_conversations (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  tenant_id       INT UNSIGNED    NOT NULL DEFAULT 1,
  user_id         INT UNSIGNED    NOT NULL,
  -- Taken from the opening message so the list reads like something a person
  -- wrote, not "Conversation #48".
  title           VARCHAR(160)    NOT NULL DEFAULT '',
  message_count   INT UNSIGNED    NOT NULL DEFAULT 0,
  -- How many writes this thread actually executed. 0 = it only asked things.
  write_count     INT UNSIGNED    NOT NULL DEFAULT 0,
  last_message_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- The only listing query: this user's threads, newest first.
  KEY idx_saic_tenant_user_recent (tenant_id, user_id, last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Turns ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_ai_messages (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id       INT UNSIGNED    NOT NULL DEFAULT 1,
  conversation_id INT UNSIGNED    NOT NULL,
  role            ENUM('user','assistant') NOT NULL,
  content         TEXT            NOT NULL,
  -- The full response envelope (choices, preview, data blocks) so a reopened
  -- thread renders exactly as it did live, not as flat text.
  response        JSON            NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saim_conversation (conversation_id, id),
  KEY idx_saim_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Confirm tokens (single-use, expiring; the audit link back to the thread) ---
CREATE TABLE IF NOT EXISTS sales_ai_intents (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  tenant_id       INT UNSIGNED    NOT NULL DEFAULT 1,
  conversation_id INT UNSIGNED    NULL,
  user_id         INT UNSIGNED    NULL,
  token           VARCHAR(64)     NOT NULL,
  intent_type     VARCHAR(120)    NOT NULL,
  payload         JSON            NOT NULL,
  preview         VARCHAR(500)    NOT NULL DEFAULT '',
  used            TINYINT(1)      NOT NULL DEFAULT 0,
  used_at         DATETIME        NULL,
  expires_at      DATETIME        NOT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saii_token (token),
  KEY idx_saii_tenant_expires (tenant_id, expires_at),
  KEY idx_saii_conversation (conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
