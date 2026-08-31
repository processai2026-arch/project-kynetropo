-- Phase 2 / Module 03: dealer price mapping, dealer customer dedupe, customer metrics.
-- Run after create_sales_billing_phase1.sql.

CREATE TABLE IF NOT EXISTS `dealer_price_lists` (
  `price_list_id` INT NOT NULL AUTO_INCREMENT,
  `dealer_id` INT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `notes` VARCHAR(500) NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`price_list_id`),
  KEY `idx_dpl_dealer` (`dealer_id`),
  KEY `idx_dpl_active` (`is_active`, `is_default`),
  CONSTRAINT `fk_dpl_dealer` FOREIGN KEY (`dealer_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dpl_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dealer_price_items` (
  `price_item_id` INT NOT NULL AUTO_INCREMENT,
  `price_list_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `notes` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`price_item_id`),
  UNIQUE KEY `uq_dpi_list_product` (`price_list_id`, `product_id`),
  KEY `idx_dpi_product` (`product_id`),
  CONSTRAINT `fk_dpi_list` FOREIGN KEY (`price_list_id`) REFERENCES `dealer_price_lists` (`price_list_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dpi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dealer_customers` (
  `dealer_customer_id` INT NOT NULL AUTO_INCREMENT,
  `dealer_id` INT NOT NULL,
  `customer_id` INT NULL,
  `price_list_id` INT NULL,
  `name` VARCHAR(200) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `normalized_phone` VARCHAR(15) NULL,
  `email` VARCHAR(120) NULL,
  `normalized_email` VARCHAR(120) NULL,
  `gstin` VARCHAR(20) NULL,
  `normalized_gstin` VARCHAR(20) NULL,
  `address` VARCHAR(255) NULL,
  `city` VARCHAR(80) NULL,
  `state` VARCHAR(80) NULL,
  `pincode` VARCHAR(10) NULL,
  `link_status` VARCHAR(20) NOT NULL DEFAULT 'dealer_added',
  `conflict_user_id` INT NULL,
  `resolution_notes` VARCHAR(500) NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`dealer_customer_id`),
  KEY `idx_dc_dealer` (`dealer_id`),
  KEY `idx_dc_customer` (`customer_id`),
  KEY `idx_dc_price_list` (`price_list_id`),
  KEY `idx_dc_status` (`link_status`),
  KEY `idx_dc_phone` (`normalized_phone`),
  KEY `idx_dc_email` (`normalized_email`),
  KEY `idx_dc_gstin` (`normalized_gstin`),
  CONSTRAINT `fk_dc_dealer` FOREIGN KEY (`dealer_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dc_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dc_price_list` FOREIGN KEY (`price_list_id`) REFERENCES `dealer_price_lists` (`price_list_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dc_conflict_user` FOREIGN KEY (`conflict_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dc_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_metrics` (
  `customer_id` INT NOT NULL,
  `total_orders` INT NOT NULL DEFAULT 0,
  `total_spend` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `avg_order_value` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `outstanding` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `avg_payment_days` DECIMAL(6,1) NULL,
  `last_order_date` DATE NULL,
  `last_invoice_date` DATE NULL,
  `segment` VARCHAR(40) NOT NULL DEFAULT 'Dormant',
  `payment_behavior` VARCHAR(20) NOT NULL DEFAULT 'unknown',
  `churn_risk` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`),
  KEY `idx_customer_metrics_segment` (`segment`),
  KEY `idx_customer_metrics_spend` (`total_spend`),
  KEY `idx_customer_metrics_payment` (`avg_payment_days`),
  CONSTRAINT `fk_customer_metrics_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
