-- CONTROL-PLANE DATABASE ONLY (the database configured through CP_DB_* / PlatformDB).
-- Do not run this against a tenant application database.
-- Adds auditable subscription lifecycle events and richer payment history fields.

SET NAMES utf8mb4;
SET @schema_name = DATABASE();

CREATE TABLE IF NOT EXISTS `subscription_lifecycle_events` (
  `event_id`       BIGINT AUTO_INCREMENT PRIMARY KEY,
  `tenant_id`      INT NOT NULL,
  `subscription_id` INT NOT NULL,
  `action`         ENUM('change_plan','cancel','resume') NOT NULL,
  `from_plan_id`   INT NULL,
  `to_plan_id`     INT NULL,
  `from_status`    VARCHAR(30) NOT NULL,
  `to_status`      VARCHAR(30) NOT NULL,
  `billing_cycle`  ENUM('monthly','yearly') NOT NULL,
  `reason`         VARCHAR(500) NOT NULL,
  `effective_at`   DATETIME NOT NULL,
  `applied_at`     DATETIME NULL,
  `status`         ENUM('scheduled','applied','superseded') NOT NULL DEFAULT 'scheduled',
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME NULL,
  KEY `idx_lifecycle_tenant_date` (`tenant_id`,`effective_at`),
  KEY `idx_lifecycle_due` (`status`,`effective_at`),
  KEY `idx_lifecycle_subscription` (`subscription_id`),
  CONSTRAINT `fk_lifecycle_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`tenant_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_lifecycle_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`subscription_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_lifecycle_from_plan` FOREIGN KEY (`from_plan_id`) REFERENCES `plans` (`plan_id`),
  CONSTRAINT `fk_lifecycle_to_plan` FOREIGN KEY (`to_plan_id`) REFERENCES `plans` (`plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payment history needs an explicit currency and settlement timestamp. These
-- idempotent additions preserve existing webhook/payment rows.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='billing_payments' AND COLUMN_NAME='currency')=0,
  'ALTER TABLE `billing_payments` ADD COLUMN `currency` VARCHAR(8) NOT NULL DEFAULT ''INR'' AFTER `amount`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='billing_payments' AND COLUMN_NAME='paid_at')=0,
  'ALTER TABLE `billing_payments` ADD COLUMN `paid_at` DATETIME NULL AFTER `status`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `billing_payments`
SET `paid_at` = `created_at`
WHERE `paid_at` IS NULL AND `status` IN ('captured','paid');

