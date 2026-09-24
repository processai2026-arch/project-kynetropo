-- RBAC (custom roles + granular permissions), TOTP MFA, audit viewer support.
-- Tenant-scoped. Safe to re-run (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS `roles` (
  `role_id`     INT NOT NULL AUTO_INCREMENT,
  `tenant_id`   INT NOT NULL,
  `name`        VARCHAR(80) NOT NULL,
  `description` VARCHAR(255) NULL,
  `permissions` JSON NULL,
  `is_system`   TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  KEY `idx_roles_tenant` (`tenant_id`),
  UNIQUE KEY `uq_roles_name` (`tenant_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_roles` (
  `tenant_id` INT NOT NULL,
  `user_id`   INT NOT NULL,
  `role_id`   INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`, `user_id`, `role_id`),
  KEY `idx_user_roles_user` (`tenant_id`, `user_id`),
  KEY `idx_user_roles_role` (`tenant_id`, `role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mfa_secrets` (
  `tenant_id`  INT NOT NULL,
  `user_id`    INT NOT NULL,
  `secret`     VARCHAR(64) NOT NULL,
  `enabled`    TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `enabled_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`tenant_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
