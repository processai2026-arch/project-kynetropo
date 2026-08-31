-- Advanced invoicing: recurring templates, payment reminders, and e-invoice IRN.
-- All additions are tenant-scoped and safe to re-run on MySQL/MariaDB versions
-- that support ADD COLUMN.

ALTER TABLE `invoices`
  ADD COLUMN `customer_email` VARCHAR(190) NULL AFTER `customer_name`,
  ADD COLUMN `recurring_template_id` INT NULL AFTER `order_id`,
  ADD COLUMN `recurring_run_date` DATE NULL AFTER `recurring_template_id`,
  ADD COLUMN `payment_reminder_sent_at` DATETIME NULL AFTER `due_date`,
  ADD COLUMN `payment_reminder_count` INT NOT NULL DEFAULT 0 AFTER `payment_reminder_sent_at`,
  ADD COLUMN `irn` VARCHAR(128) NULL AFTER `payment_reminder_count`,
  ADD COLUMN `irn_qr` LONGTEXT NULL AFTER `irn`,
  ADD COLUMN `irn_status` VARCHAR(30) NOT NULL DEFAULT 'not_generated' AFTER `irn_qr`;

CREATE TABLE IF NOT EXISTS `recurring_invoice_templates` (
  `template_id`          INT NOT NULL AUTO_INCREMENT,
  `tenant_id`            INT NOT NULL,
  `template_name`        VARCHAR(150) NOT NULL,
  `customer_name`        VARCHAR(150) NOT NULL,
  `customer_email`       VARCHAR(190) NULL,
  `customer_gstin`       VARCHAR(20) NULL,
  `customer_state`       VARCHAR(60) NOT NULL,
  `customer_address`     TEXT NULL,
  `seller_state`         VARCHAR(60) NOT NULL DEFAULT 'Tamil Nadu',
  `frequency`            ENUM('weekly','monthly','quarterly') NOT NULL,
  `next_run_date`        DATE NOT NULL,
  `due_days`             INT NOT NULL DEFAULT 0,
  `delivery_fee`         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount`             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes`                TEXT NULL,
  `terms_and_conditions` TEXT NULL,
  `active`               TINYINT(1) NOT NULL DEFAULT 1,
  `last_run_at`          DATETIME NULL,
  `created_by`           INT NULL,
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`),
  KEY `idx_recurring_templates_due` (`tenant_id`, `active`, `next_run_date`),
  KEY `idx_recurring_templates_customer` (`tenant_id`, `customer_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recurring_invoice_template_items` (
  `item_id`       INT NOT NULL AUTO_INCREMENT,
  `tenant_id`     INT NOT NULL,
  `template_id`   INT NOT NULL,
  `description`   VARCHAR(255) NOT NULL,
  `hsn_code`      VARCHAR(20) NULL,
  `quantity`      DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `unit`          VARCHAR(50) NULL DEFAULT 'Nos',
  `unit_price`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `gst_rate`      DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `sort_order`    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`item_id`),
  KEY `idx_recurring_template_items` (`tenant_id`, `template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `recurring_invoice_runs` (
  `run_id`          INT NOT NULL AUTO_INCREMENT,
  `tenant_id`       INT NOT NULL,
  `template_id`     INT NOT NULL,
  `scheduled_for`   DATE NOT NULL,
  `invoice_id`      INT NULL,
  `status`          ENUM('processing','generated','failed') NOT NULL DEFAULT 'processing',
  `error_message`   VARCHAR(500) NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at`    DATETIME NULL,
  PRIMARY KEY (`run_id`),
  UNIQUE KEY `uq_recurring_run` (`tenant_id`, `template_id`, `scheduled_for`),
  KEY `idx_recurring_runs_invoice` (`tenant_id`, `invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invoice_payment_reminders` (
  `reminder_id`       INT NOT NULL AUTO_INCREMENT,
  `tenant_id`         INT NOT NULL,
  `invoice_id`        INT NOT NULL,
  `recipient_email`   VARCHAR(190) NOT NULL,
  `subject`           VARCHAR(255) NOT NULL,
  `delivery_status`   ENUM('sent','failed') NOT NULL,
  `sent_at`           DATETIME NULL,
  `created_by`        INT NULL,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reminder_id`),
  KEY `idx_invoice_reminders_invoice` (`tenant_id`, `invoice_id`, `created_at`),
  KEY `idx_invoice_reminders_status` (`tenant_id`, `delivery_status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
