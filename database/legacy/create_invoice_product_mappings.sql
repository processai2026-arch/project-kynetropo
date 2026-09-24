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
