-- CRM module: leads, deals/pipeline, activities.
-- Every table is tenant-scoped (tenant_id INT NOT NULL + index), matching the
-- multi-tenant pattern introduced by database/migrations/001_add_tenant_id.sql.
-- Run this once against the application database (see database/migrate.php for
-- the standard migration runner used by this project).

CREATE TABLE IF NOT EXISTS `crm_leads` (
  `lead_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `company_name` VARCHAR(150) NULL,
  `email` VARCHAR(120) NULL,
  `phone` VARCHAR(20) NULL,
  `source` VARCHAR(60) NULL,
  `status` ENUM('new','contacted','qualified','lost') NOT NULL DEFAULT 'new',
  `owner_id` INT NULL,
  `notes` TEXT NULL,
  `converted_customer_id` INT NULL,
  `converted_deal_id` INT NULL,
  `converted_at` DATETIME NULL DEFAULT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lead_id`),
  KEY `idx_crm_leads_tenant` (`tenant_id`),
  KEY `idx_crm_leads_status` (`tenant_id`, `status`),
  KEY `idx_crm_leads_owner` (`tenant_id`, `owner_id`),
  KEY `idx_crm_leads_email` (`tenant_id`, `email`),
  KEY `idx_crm_leads_phone` (`tenant_id`, `phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_deals` (
  `deal_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `customer_id` INT NULL,
  `lead_id` INT NULL,
  `value` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `stage` ENUM('qualification','proposal','negotiation','won','lost') NOT NULL DEFAULT 'qualification',
  `expected_close_date` DATE NULL,
  `owner_id` INT NULL,
  `probability` TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `notes` TEXT NULL,
  `closed_at` DATETIME NULL DEFAULT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`deal_id`),
  KEY `idx_crm_deals_tenant` (`tenant_id`),
  KEY `idx_crm_deals_stage` (`tenant_id`, `stage`),
  KEY `idx_crm_deals_owner` (`tenant_id`, `owner_id`),
  KEY `idx_crm_deals_customer` (`tenant_id`, `customer_id`),
  KEY `idx_crm_deals_lead` (`tenant_id`, `lead_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `crm_activities` (
  `activity_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `type` ENUM('call','meeting','task','note') NOT NULL DEFAULT 'task',
  `subject` VARCHAR(200) NOT NULL,
  `notes` TEXT NULL,
  `related_type` ENUM('lead','deal','customer') NOT NULL,
  `related_id` INT NOT NULL,
  `due_at` DATETIME NULL DEFAULT NULL,
  `done` TINYINT(1) NOT NULL DEFAULT 0,
  `done_at` DATETIME NULL DEFAULT NULL,
  `owner_id` INT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`activity_id`),
  KEY `idx_crm_activities_tenant` (`tenant_id`),
  KEY `idx_crm_activities_related` (`tenant_id`, `related_type`, `related_id`),
  KEY `idx_crm_activities_owner` (`tenant_id`, `owner_id`),
  KEY `idx_crm_activities_due` (`tenant_id`, `due_at`),
  KEY `idx_crm_activities_done` (`tenant_id`, `done`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
