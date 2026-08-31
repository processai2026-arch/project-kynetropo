-- =============================================================================
-- create_chat_extra.sql
-- Tenant-scoped persistence for the cross-module AI assistant (ChatController).
--
-- The legacy public website chatbot uses `chat_sessions` / `chat_messages`.
-- The in-app (authenticated) assistant uses its own conversation store so that
-- history is scoped per tenant AND per user, and so the legacy tables are never
-- altered. Every table carries tenant_id and is created idempotently.
--
-- Inserts in PHP MUST use Database::insertTenant() (auto-stamps tenant_id).
-- =============================================================================

CREATE TABLE IF NOT EXISTS `chat_conversations` (
  `conversation_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id`       INT NOT NULL,
  `user_id`         INT NULL DEFAULT NULL,
  `title`           VARCHAR(200) NOT NULL DEFAULT 'New conversation',
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`),
  KEY `idx_chat_conv_tenant_user` (`tenant_id`, `user_id`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chat_conversation_messages` (
  `message_id`      INT NOT NULL AUTO_INCREMENT,
  `tenant_id`       INT NOT NULL,
  `conversation_id` INT NOT NULL,
  `role`            ENUM('user','assistant') NOT NULL,
  `content`         MEDIUMTEXT NOT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `idx_chat_msg_conv` (`tenant_id`, `conversation_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
