-- Wave B P1 module additions. Safe to re-run.
-- Run the query section on each tenant business DB. Run the billing section
-- (from billing_webhook_events onward) on the control-plane DB used by PlatformDB.
SET @schema_name = DATABASE();

CREATE TABLE IF NOT EXISTS `query_messages` (
  `message_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `query_id` INT NOT NULL,
  `sender_type` ENUM('customer','staff','system') NOT NULL,
  `sender_user_id` INT NULL,
  `message` TEXT NOT NULL,
  `delivery_channel` VARCHAR(30) NULL,
  `delivery_status` ENUM('not_requested','sent','failed') NOT NULL DEFAULT 'not_requested',
  `delivery_error` VARCHAR(500) NULL,
  `delivered_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `idx_query_messages_thread` (`tenant_id`, `query_id`, `created_at`),
  KEY `idx_query_messages_sender` (`tenant_id`, `sender_user_id`),
  CONSTRAINT `fk_query_messages_query` FOREIGN KEY (`query_id`) REFERENCES `queries` (`query_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_query_messages_sender` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries')=1 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries' AND COLUMN_NAME='assigned_to')=0,
  'ALTER TABLE `queries` ADD COLUMN `assigned_to` INT NULL AFTER `admin_reply`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries')=1 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries' AND COLUMN_NAME='priority')=0,
  'ALTER TABLE `queries` ADD COLUMN `priority` ENUM(''low'',''normal'',''high'',''urgent'') NOT NULL DEFAULT ''normal'' AFTER `assigned_to`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries')=1 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries' AND COLUMN_NAME='sla_due_at')=0,
  'ALTER TABLE `queries` ADD COLUMN `sla_due_at` DATETIME NULL AFTER `priority`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries')=1 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries' AND COLUMN_NAME='resolved_at')=0,
  'ALTER TABLE `queries` ADD COLUMN `resolved_at` DATETIME NULL AFTER `status`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries')=1 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries' AND COLUMN_NAME='closed_at')=0,
  'ALTER TABLE `queries` ADD COLUMN `closed_at` DATETIME NULL AFTER `resolved_at`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries')=1 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='queries' AND COLUMN_NAME='updated_at')=0,
  'ALTER TABLE `queries` ADD COLUMN `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- This table belongs in the control-plane database used by PlatformDB.
CREATE TABLE IF NOT EXISTS `billing_webhook_events` (
  `webhook_event_id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `gateway` VARCHAR(30) NOT NULL DEFAULT 'razorpay',
  `gateway_event_id` VARCHAR(120) NOT NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `gateway_order_id` VARCHAR(120) NULL,
  `gateway_payment_id` VARCHAR(120) NULL,
  `status` ENUM('processing','processed','ignored','failed') NOT NULL DEFAULT 'processing',
  `failure_reason` VARCHAR(500) NULL,
  `raw_event` MEDIUMTEXT NULL,
  `processed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`webhook_event_id`),
  UNIQUE KEY `uq_billing_webhook_event` (`gateway`, `gateway_event_id`),
  KEY `idx_billing_webhook_tenant` (`tenant_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='subscriptions')=1 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='subscriptions' AND COLUMN_NAME='gateway_order_id')=0,
  'ALTER TABLE `subscriptions` ADD COLUMN `gateway_order_id` VARCHAR(120) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='subscriptions')=1 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='subscriptions' AND COLUMN_NAME='gateway_expected_amount')=0,
  'ALTER TABLE `subscriptions` ADD COLUMN `gateway_expected_amount` BIGINT NULL COMMENT ''minor currency units''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='subscriptions')=1 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='subscriptions' AND COLUMN_NAME='gateway_currency')=0,
  'ALTER TABLE `subscriptions` ADD COLUMN `gateway_currency` VARCHAR(10) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='subscriptions')=1 AND (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='subscriptions' AND INDEX_NAME='idx_subscriptions_gateway_order')=0,
  'CREATE INDEX `idx_subscriptions_gateway_order` ON `subscriptions` (`gateway_order_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
