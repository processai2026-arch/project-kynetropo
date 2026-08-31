-- Phase 2 / Module 04: finance analytics planning tables.
-- Run after create_sales_billing_phase1.sql and create_procurement_phase2_inventory.sql.

CREATE TABLE IF NOT EXISTS `budgets` (
  `budget_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `fiscal_year` VARCHAR(9) NOT NULL,
  `period_type` VARCHAR(10) NOT NULL DEFAULT 'monthly',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` VARCHAR(500) NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`budget_id`),
  KEY `idx_budgets_active_year` (`is_active`, `fiscal_year`),
  CONSTRAINT `fk_budgets_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_lines` (
  `line_id` INT NOT NULL AUTO_INCREMENT,
  `budget_id` INT NOT NULL,
  `category` VARCHAR(80) NOT NULL,
  `period` VARCHAR(7) NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `notes` VARCHAR(255) NULL,
  PRIMARY KEY (`line_id`),
  UNIQUE KEY `uq_budget_cat_period` (`budget_id`, `category`, `period`),
  KEY `idx_budget_lines_period` (`period`),
  CONSTRAINT `fk_budget_lines_budget` FOREIGN KEY (`budget_id`) REFERENCES `budgets` (`budget_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `benchmarks` (
  `benchmark_id` INT NOT NULL AUTO_INCREMENT,
  `metric` VARCHAR(60) NOT NULL,
  `target_value` DECIMAL(14,4) NOT NULL,
  `unit` VARCHAR(10) NULL,
  `comparison` VARCHAR(4) NOT NULL DEFAULT 'gte',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` VARCHAR(255) NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`benchmark_id`),
  UNIQUE KEY `uq_benchmark_metric` (`metric`),
  KEY `idx_benchmarks_active` (`is_active`),
  CONSTRAINT `fk_benchmarks_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
