-- ============================================================
-- ANNAI ENTERPRISES — Complete Invoice Module Database Setup
-- Run this ONCE in phpMyAdmin to create all tables
-- All tables use CREATE TABLE IF NOT EXISTS — safe to re-run
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. CORE AUTH TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
  `user_id`       INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`     INT NOT NULL DEFAULT 1,
  `name`          VARCHAR(255) NOT NULL,
  `email`         VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `phone`         VARCHAR(20) DEFAULT NULL,
  `user_type`     VARCHAR(30) NOT NULL DEFAULT 'admin',
  `staff_role`    VARCHAR(30) DEFAULT NULL,
  `permissions`   JSON DEFAULT NULL,
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `business_name` VARCHAR(255) DEFAULT NULL,
  `gstin`         VARCHAR(15) DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `revoked_tokens` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `token_hash`  VARCHAR(64) NOT NULL,
  `revoked_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rt_hash` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`   INT NOT NULL DEFAULT 1,
  `user_id`     INT(11) NOT NULL,
  `token_hash`  VARCHAR(64) NOT NULL,
  `expires_at`  DATETIME NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rft_hash` (`token_hash`),
  KEY `idx_rft_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `settings` (
  `id`            INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`     INT NOT NULL DEFAULT 1,
  `setting_key`   VARCHAR(80) NOT NULL,
  `setting_value` TEXT DEFAULT NULL,
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_t_key` (`tenant_id`, `setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id`          INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`   INT NOT NULL DEFAULT 1,
  `user_id`     INT(11) DEFAULT NULL,
  `action`      VARCHAR(80) NOT NULL,
  `table_name`  VARCHAR(60) DEFAULT NULL,
  `record_id`   INT(11) DEFAULT NULL,
  `old_value`   TEXT DEFAULT NULL,
  `new_value`   TEXT DEFAULT NULL,
  `ip_address`  VARCHAR(45) DEFAULT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_tenant` (`tenant_id`),
  KEY `idx_audit_user`   (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. INVOICE CUSTOMERS
-- ============================================================

CREATE TABLE IF NOT EXISTS `invoice_customers` (
  `customer_id`       INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`         INT NOT NULL,
  `name`              VARCHAR(255) NOT NULL,
  `email`             VARCHAR(255) DEFAULT NULL,
  `phone`             VARCHAR(15) DEFAULT NULL,
  `gstin`             VARCHAR(15) DEFAULT NULL,
  `address_line1`     VARCHAR(255) DEFAULT NULL,
  `city`              VARCHAR(100) DEFAULT NULL,
  `state`             VARCHAR(100) DEFAULT NULL,
  `pincode`           VARCHAR(10) DEFAULT NULL,
  `customer_type`     ENUM('b2b','b2c') NOT NULL DEFAULT 'b2c',
  `total_purchases`   INT NOT NULL DEFAULT 0,
  `lifetime_revenue`  DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`),
  KEY `idx_inv_customers_tenant`      (`tenant_id`),
  KEY `idx_inv_customers_tenant_type` (`tenant_id`, `customer_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. INVOICE PRODUCTS (catalog)
-- ============================================================

CREATE TABLE IF NOT EXISTS `invoice_products` (
  `product_id`       INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`        INT NOT NULL,
  `sku`              VARCHAR(100) NOT NULL,
  `name`             VARCHAR(255) NOT NULL,
  `description`      TEXT DEFAULT NULL,
  `category`         VARCHAR(100) DEFAULT NULL,
  `hsn_code`         VARCHAR(20) DEFAULT NULL,
  `input_gst_rate`   DECIMAL(5,2) DEFAULT 0.00,
  `input_gst_amount` DECIMAL(12,2) DEFAULT 0.00,
  `unit`             VARCHAR(20) NOT NULL DEFAULT 'pcs',
  `cost_price`       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `selling_price`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `current_stock`    INT NOT NULL DEFAULT 0,
  `damaged_stock`    INT NOT NULL DEFAULT 0,
  `min_stock_level`  INT NOT NULL DEFAULT 5,
  `max_stock_level`  INT NOT NULL DEFAULT 100,
  `is_active`        TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`product_id`),
  UNIQUE KEY `uq_inv_product_tenant_sku` (`tenant_id`, `sku`),
  KEY `idx_inv_products_tenant`        (`tenant_id`),
  KEY `idx_inv_products_tenant_active` (`tenant_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. SCAN INVOICES (uploaded invoices with AI extraction)
-- ============================================================

CREATE TABLE IF NOT EXISTS `scan_invoices` (
  `invoice_id`          INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`           INT NOT NULL,
  `file_path`           VARCHAR(500) NOT NULL,
  `file_type`           ENUM('pdf','jpg','png') NOT NULL,
  `original_filename`   VARCHAR(255) NOT NULL,
  `invoice_number`      VARCHAR(100) DEFAULT NULL,
  `invoice_date`        DATE DEFAULT NULL,
  `marketplace`         ENUM('amazon','flipkart','meesho','other') NOT NULL DEFAULT 'other',
  `invoice_type`        ENUM('sale','purchase','return','commission') NOT NULL DEFAULT 'sale',
  `is_damaged`          TINYINT(1) NOT NULL DEFAULT 0,
  `is_credit_sale`      TINYINT(1) NOT NULL DEFAULT 0,
  `credit_days`         INT NOT NULL DEFAULT 30,
  `vendor_name`         VARCHAR(255) DEFAULT NULL,
  `vendor_gstin`        VARCHAR(15) DEFAULT NULL,
  `customer_id`         INT(11) DEFAULT NULL,
  `subtotal`            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_amount`          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_amount`        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `shipping_charges`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `commission_amount`   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `processing_status`   ENUM('pending','processing','review','approved','rejected','error') NOT NULL DEFAULT 'pending',
  `ai_confidence_score` DECIMAL(5,2) DEFAULT NULL,
  `extracted_data`      JSON DEFAULT NULL,
  `validated_data`      JSON DEFAULT NULL,
  `error_message`       TEXT DEFAULT NULL,
  `processed_at`        DATETIME DEFAULT NULL,
  `approved_at`         DATETIME DEFAULT NULL,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`invoice_id`),
  KEY `idx_scan_inv_tenant`        (`tenant_id`),
  KEY `idx_scan_inv_tenant_status` (`tenant_id`, `processing_status`),
  KEY `idx_scan_inv_tenant_market` (`tenant_id`, `marketplace`),
  KEY `idx_scan_inv_tenant_type`   (`tenant_id`, `invoice_type`),
  KEY `idx_scan_inv_tenant_date`   (`tenant_id`, `invoice_date`),
  KEY `idx_scan_inv_tenant_credit` (`tenant_id`, `is_credit_sale`),
  CONSTRAINT `fk_scan_inv_customer` FOREIGN KEY (`customer_id`) REFERENCES `invoice_customers` (`customer_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. SCAN INVOICE LINE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS `scan_invoice_line_items` (
  `line_item_id`     INT(11) NOT NULL AUTO_INCREMENT,
  `invoice_id`       INT(11) NOT NULL,
  `product_id`       INT(11) DEFAULT NULL,
  `sku`              VARCHAR(100) DEFAULT NULL,
  `product_name`     VARCHAR(255) NOT NULL,
  `hsn_code`         VARCHAR(20) DEFAULT NULL,
  `quantity`         DECIMAL(10,3) NOT NULL,
  `unit_price`       DECIMAL(12,2) NOT NULL,
  `discount`         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `taxable_value`    DECIMAL(12,2) NOT NULL,
  `cgst_rate`        DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `cgst_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `sgst_rate`        DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `sgst_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `igst_rate`        DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `igst_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_amount`     DECIMAL(12,2) NOT NULL,
  `confidence_score` DECIMAL(5,2) DEFAULT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`line_item_id`),
  KEY `idx_scan_li_invoice`  (`invoice_id`),
  KEY `idx_scan_li_product`  (`product_id`),
  CONSTRAINT `fk_scan_li_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_scan_li_product` FOREIGN KEY (`product_id`) REFERENCES `invoice_products` (`product_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. INVENTORY TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS `invoice_inventory_transactions` (
  `transaction_id`   INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`        INT NOT NULL,
  `product_id`       INT(11) NOT NULL,
  `invoice_id`       INT(11) DEFAULT NULL,
  `transaction_type` ENUM('sale','purchase','adjustment','return') NOT NULL,
  `quantity_change`  INT NOT NULL,
  `stock_before`     INT NOT NULL,
  `stock_after`      INT NOT NULL,
  `notes`            TEXT DEFAULT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transaction_id`),
  KEY `idx_inv_tx2_tenant`  (`tenant_id`),
  KEY `idx_inv_tx2_product` (`tenant_id`, `product_id`),
  KEY `idx_inv_tx2_invoice` (`invoice_id`),
  CONSTRAINT `fk_inv_tx2_product` FOREIGN KEY (`product_id`) REFERENCES `invoice_products` (`product_id`),
  CONSTRAINT `fk_inv_tx2_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. MARKETPLACE SALES ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS `marketplace_sales_orders` (
  `order_id`              INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`             INT NOT NULL,
  `invoice_id`            INT(11) NOT NULL,
  `customer_id`           INT(11) DEFAULT NULL,
  `order_number`          VARCHAR(100) NOT NULL,
  `order_date`            DATE NOT NULL,
  `marketplace`           ENUM('amazon','flipkart','meesho','other') NOT NULL,
  `marketplace_order_id`  VARCHAR(200) DEFAULT NULL,
  `subtotal`              DECIMAL(12,2) NOT NULL,
  `discount`              DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_amount`            DECIMAL(12,2) NOT NULL,
  `shipping_charges`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `commission_amount`     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_amount`          DECIMAL(12,2) NOT NULL,
  `net_revenue`           DECIMAL(12,2) NOT NULL,
  `status`                ENUM('completed','pending','cancelled','returned') NOT NULL DEFAULT 'completed',
  `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_id`),
  KEY `idx_mp_orders_tenant`        (`tenant_id`),
  KEY `idx_mp_orders_tenant_date`   (`tenant_id`, `order_date`),
  KEY `idx_mp_orders_tenant_market` (`tenant_id`, `marketplace`),
  KEY `idx_mp_orders_tenant_status` (`tenant_id`, `status`),
  KEY `idx_mp_orders_invoice`       (`invoice_id`),
  CONSTRAINT `fk_mp_orders_invoice`  FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`),
  CONSTRAINT `fk_mp_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `invoice_customers` (`customer_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. GST RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS `gst_records` (
  `gst_record_id`    INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`        INT NOT NULL,
  `invoice_id`       INT(11) NOT NULL,
  `line_item_id`     INT(11) DEFAULT NULL,
  `gstin_supplier`   VARCHAR(15) DEFAULT NULL,
  `gstin_recipient`  VARCHAR(15) DEFAULT NULL,
  `hsn_code`         VARCHAR(20) DEFAULT NULL,
  `taxable_value`    DECIMAL(12,2) NOT NULL,
  `cgst_rate`        DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `cgst_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `sgst_rate`        DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `sgst_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `igst_rate`        DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `igst_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_tax`        DECIMAL(12,2) NOT NULL,
  `supply_type`      ENUM('b2b','b2c') NOT NULL DEFAULT 'b2c',
  `transaction_date` DATE NOT NULL,
  `financial_year`   VARCHAR(7) NOT NULL,
  `quarter`          TINYINT NOT NULL,
  `month`            TINYINT NOT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`gst_record_id`),
  KEY `idx_gst_tenant`       (`tenant_id`),
  KEY `idx_gst_tenant_fy`    (`tenant_id`, `financial_year`),
  KEY `idx_gst_tenant_month` (`tenant_id`, `financial_year`, `month`),
  KEY `idx_gst_invoice`      (`invoice_id`),
  CONSTRAINT `fk_gst_scan_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`),
  CONSTRAINT `fk_gst_line_item`    FOREIGN KEY (`line_item_id`) REFERENCES `scan_invoice_line_items` (`line_item_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. JOURNAL ENTRIES
-- ============================================================

CREATE TABLE IF NOT EXISTS `invoice_journal_entries` (
  `entry_id`       INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`      INT NOT NULL,
  `invoice_id`     INT(11) DEFAULT NULL,
  `entry_date`     DATE NOT NULL,
  `entry_number`   VARCHAR(50) NOT NULL,
  `description`    TEXT NOT NULL,
  `debit_account`  VARCHAR(100) NOT NULL,
  `credit_account` VARCHAR(100) NOT NULL,
  `amount`         DECIMAL(12,2) NOT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`entry_id`),
  KEY `idx_inv_journal_tenant`      (`tenant_id`),
  KEY `idx_inv_journal_tenant_date` (`tenant_id`, `entry_date`),
  KEY `idx_inv_journal_invoice`     (`invoice_id`),
  CONSTRAINT `fk_inv_journal_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. MARKETPLACE EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS `marketplace_expenses` (
  `expense_id`    INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`     INT NOT NULL,
  `invoice_id`    INT(11) DEFAULT NULL,
  `category`      VARCHAR(100) NOT NULL,
  `description`   VARCHAR(255) NOT NULL,
  `amount`        DECIMAL(12,2) NOT NULL,
  `expense_date`  DATE NOT NULL,
  `marketplace`   ENUM('amazon','flipkart','meesho','other','none') NOT NULL DEFAULT 'none',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`expense_id`),
  KEY `idx_mp_exp_tenant`          (`tenant_id`),
  KEY `idx_mp_exp_tenant_date`     (`tenant_id`, `expense_date`),
  KEY `idx_mp_exp_tenant_category` (`tenant_id`, `category`),
  CONSTRAINT `fk_mp_exp_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. MARKETPLACE SETTLEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS `marketplace_settlements` (
  `settlement_id`          INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`              INT NOT NULL,
  `marketplace`            ENUM('amazon','flipkart','meesho') NOT NULL,
  `external_id`            VARCHAR(100) DEFAULT NULL,
  `period_start`           DATE NOT NULL,
  `period_end`             DATE NOT NULL,
  `gross_sales`            DECIMAL(14,2) NOT NULL,
  `returns_refunds`        DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `marketplace_commission` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `tds_deducted`           DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `payment_received`       DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `expected_amount`        DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `difference`             DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status`                 ENUM('pending','received','disputed') NOT NULL DEFAULT 'pending',
  `settled_at`             DATETIME DEFAULT NULL,
  `created_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlement_id`),
  KEY `idx_mp_settlements_tenant`        (`tenant_id`),
  KEY `idx_mp_settlements_tenant_market` (`tenant_id`, `marketplace`),
  KEY `idx_mp_settlements_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. INVOICE NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS `invoice_notifications` (
  `notification_id` INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`       INT NOT NULL,
  `type`            ENUM('low_stock','duplicate_invoice','gst_mismatch','invoice_error','ai_low_confidence','new_sales_record','inventory_warning','gst_due') NOT NULL,
  `title`           VARCHAR(255) NOT NULL,
  `message`         TEXT NOT NULL,
  `data`            JSON DEFAULT NULL,
  `is_read`         TINYINT(1) NOT NULL DEFAULT 0,
  `read_at`         DATETIME DEFAULT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `idx_inv_notif_tenant`      (`tenant_id`),
  KEY `idx_inv_notif_tenant_read` (`tenant_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. INVOICE PRODUCT MAPPINGS (legacy single-table — kept for compatibility)
-- ============================================================

CREATE TABLE IF NOT EXISTS `invoice_product_mappings` (
  `mapping_id`     INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`      INT NOT NULL,
  `extracted_name` VARCHAR(255) NOT NULL,
  `product_id`     INT(11) NOT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mapping_id`),
  UNIQUE KEY `uq_inv_mapping_tenant_name` (`tenant_id`, `extracted_name`),
  KEY `idx_inv_mappings_tenant` (`tenant_id`),
  CONSTRAINT `fk_inv_mapping_product` FOREIGN KEY (`product_id`) REFERENCES `invoice_products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. DAMAGED STOCK
-- ============================================================

CREATE TABLE IF NOT EXISTS `damaged_stock` (
  `damaged_id`     INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`      INT NOT NULL,
  `product_id`     INT(11) NOT NULL,
  `invoice_id`     INT(11) DEFAULT NULL,
  `sku`            VARCHAR(100) NOT NULL,
  `product_name`   VARCHAR(255) NOT NULL,
  `category`       VARCHAR(100) DEFAULT NULL,
  `damaged_qty`    INT NOT NULL DEFAULT 0,
  `cost_price`     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `written_off`    TINYINT(1) NOT NULL DEFAULT 0,
  `written_off_at` DATETIME DEFAULT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`damaged_id`),
  KEY `idx_damaged_tenant`      (`tenant_id`),
  KEY `idx_damaged_tenant_prod` (`tenant_id`, `product_id`),
  CONSTRAINT `fk_damaged_product` FOREIGN KEY (`product_id`) REFERENCES `invoice_products` (`product_id`),
  CONSTRAINT `fk_damaged_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. PRODUCT MAPPINGS (two-table combo system)
--     Supports: "FASHION KIT" → SKU-A × 1 + SKU-B × 1
-- ============================================================

CREATE TABLE IF NOT EXISTS `product_mappings` (
  `mapping_id`           INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`            INT NOT NULL,
  `invoice_product_name` VARCHAR(500) NOT NULL,
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`mapping_id`),
  UNIQUE KEY `uq_pm_tenant_name` (`tenant_id`, `invoice_product_name`(255)),
  KEY `idx_pm_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_mapping_items` (
  `item_id`    INT(11) NOT NULL AUTO_INCREMENT,
  `mapping_id` INT(11) NOT NULL,
  `tenant_id`  INT NOT NULL,
  `product_id` INT(11) NOT NULL,
  `quantity`   DECIMAL(10,3) NOT NULL DEFAULT 1.000,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`),
  KEY `idx_pmi_mapping` (`mapping_id`),
  KEY `idx_pmi_tenant`  (`tenant_id`),
  KEY `idx_pmi_product` (`product_id`),
  CONSTRAINT `fk_pmi_mapping` FOREIGN KEY (`mapping_id`) REFERENCES `product_mappings` (`mapping_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pmi_product` FOREIGN KEY (`product_id`) REFERENCES `invoice_products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 16. OUTSTANDING ENTRIES + PAYMENT TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS `outstanding_entries` (
  `entry_id`       INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`      INT NOT NULL,
  `invoice_id`     INT(11) NOT NULL,
  `type`           ENUM('receivable','payable') NOT NULL,
  `party_name`     VARCHAR(255) NOT NULL,
  `party_gstin`    VARCHAR(15) DEFAULT NULL,
  `invoice_number` VARCHAR(100) DEFAULT NULL,
  `invoice_date`   DATE DEFAULT NULL,
  `due_date`       DATE DEFAULT NULL,
  `total_amount`   DECIMAL(12,2) NOT NULL,
  `paid_amount`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `balance_amount` DECIMAL(12,2) NOT NULL,
  `status`         ENUM('pending','partial','paid') NOT NULL DEFAULT 'pending',
  `credit_days`    INT NOT NULL DEFAULT 30,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`entry_id`),
  KEY `idx_oe_tenant`        (`tenant_id`),
  KEY `idx_oe_tenant_type`   (`tenant_id`, `type`),
  KEY `idx_oe_tenant_status` (`tenant_id`, `status`),
  KEY `idx_oe_invoice`       (`invoice_id`),
  CONSTRAINT `fk_oe_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `outstanding_payments` (
  `payment_id`     INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`      INT NOT NULL,
  `entry_id`       INT(11) NOT NULL,
  `amount`         DECIMAL(12,2) NOT NULL,
  `payment_date`   DATE NOT NULL,
  `payment_method` VARCHAR(50) DEFAULT NULL,
  `notes`          TEXT DEFAULT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`payment_id`),
  KEY `idx_op_tenant` (`tenant_id`),
  KEY `idx_op_entry`  (`entry_id`),
  CONSTRAINT `fk_op_entry` FOREIGN KEY (`entry_id`) REFERENCES `outstanding_entries` (`entry_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- DONE — all tables created
-- ============================================================
