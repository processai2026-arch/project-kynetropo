-- Two-table product mapping system: parent mapping + child items
-- Replaces the simplified single-table invoice_product_mappings
-- Supports combo/bundle products: "FASHION KIT" → SKU-A × 1 + SKU-B × 1
-- Run AFTER: create_invoice_products.sql

CREATE TABLE IF NOT EXISTS `product_mappings` (
  `mapping_id`           INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`            INT NOT NULL,
  `invoice_product_name` VARCHAR(500) NOT NULL
              COMMENT 'Normalized: lowercase, no quotes, collapsed spaces',
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
  `quantity`   DECIMAL(10,3) NOT NULL DEFAULT 1.000
              COMMENT 'Per-invoice-unit deduction: e.g. 1 kit = 2 units of product',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`),
  KEY `idx_pmi_mapping`  (`mapping_id`),
  KEY `idx_pmi_tenant`   (`tenant_id`),
  KEY `idx_pmi_product`  (`product_id`),
  CONSTRAINT `fk_pmi_mapping`  FOREIGN KEY (`mapping_id`) REFERENCES `product_mappings` (`mapping_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pmi_product`  FOREIGN KEY (`product_id`) REFERENCES `invoice_products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
