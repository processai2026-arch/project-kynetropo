-- Phase 2 / Module 02: sales billing, receipts, sales documents, test certificates, GST compliance.
-- Run after create_document_sequences.sql, create_attachments.sql, and the procurement migrations.

SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'payment_status') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `payment_status` VARCHAR(20) NULL AFTER `payment_method`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'amount_paid') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `amount_paid` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `total`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'last_payment_at') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `last_payment_at` DATETIME NULL AFTER `payment_status`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'discount') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `delivery_fee`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'customer_city') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `customer_city` VARCHAR(80) NULL AFTER `customer_address`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'customer_pincode') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `customer_pincode` VARCHAR(10) NULL AFTER `customer_city`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'customer_country') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `customer_country` VARCHAR(80) NULL AFTER `customer_pincode`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'invoice_date') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `invoice_date` DATE NULL AFTER `due_date`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'payment_terms') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `payment_terms` VARCHAR(100) NULL AFTER `invoice_date`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'place_of_supply') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `place_of_supply` VARCHAR(100) NULL AFTER `payment_terms`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'ship_to') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `ship_to` TEXT NULL AFTER `place_of_supply`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND COLUMN_NAME = 'subject') = 0,
  'ALTER TABLE `invoices` ADD COLUMN `subject` VARCHAR(255) NULL AFTER `ship_to`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoice_items' AND COLUMN_NAME = 'unit') = 0,
  'ALTER TABLE `invoice_items` ADD COLUMN `unit` VARCHAR(20) NULL AFTER `quantity`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `payments` (
  `payment_id` INT NOT NULL AUTO_INCREMENT,
  `payment_number` VARCHAR(50) NOT NULL,
  `direction` ENUM('in','out') NOT NULL DEFAULT 'in',
  `invoice_id` INT NULL,
  `po_id` INT NULL,
  `user_id` INT NULL,
  `vendor_id` INT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_mode` VARCHAR(30) NOT NULL,
  `reference_no` VARCHAR(120) NULL,
  `paid_on` DATE NOT NULL,
  `notes` TEXT NULL,
  `status` ENUM('posted','void') NOT NULL DEFAULT 'posted',
  `voided_by` INT NULL,
  `voided_at` DATETIME NULL,
  `void_reason` VARCHAR(255) NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`payment_id`),
  UNIQUE KEY `uq_payments_number` (`payment_number`),
  KEY `idx_payments_invoice` (`invoice_id`),
  KEY `idx_payments_po` (`po_id`),
  KEY `idx_payments_user` (`user_id`),
  KEY `idx_payments_vendor` (`vendor_id`),
  KEY `idx_payments_direction_date` (`direction`, `paid_on`),
  KEY `idx_payments_status_date` (`status`, `paid_on`),
  CONSTRAINT `fk_payments_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`invoice_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`po_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`vendor_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_voided_by` FOREIGN KEY (`voided_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_documents` (
  `document_id` INT NOT NULL AUTO_INCREMENT,
  `document_type` ENUM('quotation','proforma') NOT NULL,
  `document_number` VARCHAR(50) NOT NULL,
  `source_quote_id` INT NULL,
  `source_document_id` INT NULL,
  `converted_document_id` INT NULL,
  `invoice_id` INT NULL,
  `user_id` INT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `customer_email` VARCHAR(150) NULL,
  `customer_phone` VARCHAR(30) NULL,
  `customer_gstin` VARCHAR(20) NULL,
  `customer_state` VARCHAR(60) NULL,
  `customer_address` TEXT NULL,
  `customer_city` VARCHAR(80) NULL,
  `customer_pincode` VARCHAR(10) NULL,
  `customer_country` VARCHAR(80) NULL,
  `seller_state` VARCHAR(60) NULL DEFAULT 'Tamil Nadu',
  `document_date` DATE NOT NULL,
  `valid_until` DATE NULL,
  `due_date` DATE NULL,
  `payment_terms` VARCHAR(100) NULL,
  `place_of_supply` VARCHAR(100) NULL,
  `ship_to` TEXT NULL,
  `subject` VARCHAR(255) NULL,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `gst_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `gst_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cgst_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `sgst_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `igst_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `delivery_fee` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('draft','sent','accepted','rejected','expired','converted','cancelled') NOT NULL DEFAULT 'draft',
  `terms` TEXT NULL,
  `notes` TEXT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`document_id`),
  UNIQUE KEY `uq_sales_documents_number` (`document_number`),
  KEY `idx_sales_documents_type_status` (`document_type`, `status`),
  KEY `idx_sales_documents_customer` (`user_id`, `customer_name`),
  KEY `idx_sales_documents_source_quote` (`source_quote_id`),
  KEY `idx_sales_documents_invoice` (`invoice_id`),
  CONSTRAINT `fk_sales_documents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_documents_source_quote` FOREIGN KEY (`source_quote_id`) REFERENCES `quotes` (`quote_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_documents_source_document` FOREIGN KEY (`source_document_id`) REFERENCES `sales_documents` (`document_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_documents_converted_document` FOREIGN KEY (`converted_document_id`) REFERENCES `sales_documents` (`document_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_documents_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`invoice_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sales_documents_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_document_items` (
  `item_id` INT NOT NULL AUTO_INCREMENT,
  `document_id` INT NOT NULL,
  `product_id` INT NULL,
  `description` VARCHAR(255) NOT NULL,
  `hsn_code` VARCHAR(20) NULL,
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  `unit` VARCHAR(20) NULL DEFAULT 'Nos',
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `gst_rate` DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  `line_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`item_id`),
  KEY `idx_sales_document_items_document` (`document_id`),
  KEY `idx_sales_document_items_product` (`product_id`),
  CONSTRAINT `fk_sales_document_items_document` FOREIGN KEY (`document_id`) REFERENCES `sales_documents` (`document_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sales_document_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `test_certificates` (
  `certificate_id` INT NOT NULL AUTO_INCREMENT,
  `certificate_number` VARCHAR(50) NOT NULL,
  `invoice_id` INT NULL,
  `invoice_item_id` INT NULL,
  `product_id` INT NULL,
  `batch_no` VARCHAR(80) NULL,
  `certificate_type` VARCHAR(80) NOT NULL DEFAULT 'quality',
  `sample_date` DATE NULL,
  `issue_date` DATE NOT NULL,
  `parameters_json` JSON NULL,
  `result_summary` TEXT NULL,
  `status` ENUM('draft','issued','void') NOT NULL DEFAULT 'draft',
  `attachment_id` INT NULL,
  `issued_by` INT NULL,
  `voided_by` INT NULL,
  `voided_at` DATETIME NULL,
  `void_reason` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`certificate_id`),
  UNIQUE KEY `uq_test_certificates_number` (`certificate_number`),
  KEY `idx_test_certificates_invoice` (`invoice_id`),
  KEY `idx_test_certificates_product` (`product_id`),
  KEY `idx_test_certificates_status_issue` (`status`, `issue_date`),
  CONSTRAINT `fk_test_certificates_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`invoice_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_test_certificates_invoice_item` FOREIGN KEY (`invoice_item_id`) REFERENCES `invoice_items` (`item_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_test_certificates_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_test_certificates_attachment` FOREIGN KEY (`attachment_id`) REFERENCES `attachments` (`attachment_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_test_certificates_issued_by` FOREIGN KEY (`issued_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_test_certificates_voided_by` FOREIGN KEY (`voided_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gst_compliance_periods` (
  `period_id` INT NOT NULL AUTO_INCREMENT,
  `period_key` CHAR(7) NOT NULL,
  `from_date` DATE NOT NULL,
  `to_date` DATE NOT NULL,
  `sales_taxable` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `sales_cgst` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `sales_sgst` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `sales_igst` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `input_tax` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `net_payable` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('draft','reviewed','filed','locked') NOT NULL DEFAULT 'draft',
  `filed_on` DATE NULL,
  `reference_no` VARCHAR(120) NULL,
  `notes` TEXT NULL,
  `locked_by` INT NULL,
  `locked_at` DATETIME NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`period_id`),
  UNIQUE KEY `uq_gst_compliance_period_key` (`period_key`),
  KEY `idx_gst_compliance_status` (`status`),
  CONSTRAINT `fk_gst_compliance_locked_by` FOREIGN KEY (`locked_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_gst_compliance_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
