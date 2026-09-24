-- Advanced product catalogue: reusable price lists, variants, and composite kits.
-- Apply after the base products table exists.

CREATE TABLE IF NOT EXISTS `price_lists` (
  `price_list_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` VARCHAR(500) NULL,
  `effective_from` DATE NOT NULL,
  `effective_to` DATE NULL,
  `priority` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`price_list_id`),
  UNIQUE KEY `uq_price_lists_tenant_name_from` (`tenant_id`, `name`, `effective_from`),
  KEY `idx_price_lists_effective` (`tenant_id`, `is_active`, `effective_from`, `effective_to`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `price_list_items` (
  `price_list_item_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `price_list_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `unit_price` DECIMAL(14,4) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`price_list_item_id`),
  UNIQUE KEY `uq_price_list_item_product` (`tenant_id`, `price_list_id`, `product_id`),
  KEY `idx_price_list_items_product` (`tenant_id`, `product_id`),
  CONSTRAINT `fk_price_list_items_list` FOREIGN KEY (`price_list_id`) REFERENCES `price_lists` (`price_list_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_price_list_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `price_list_quantity_tiers` (
  `price_tier_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `price_list_item_id` INT NOT NULL,
  `min_quantity` DECIMAL(14,3) NOT NULL,
  `max_quantity` DECIMAL(14,3) NULL,
  `unit_price` DECIMAL(14,4) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`price_tier_id`),
  UNIQUE KEY `uq_price_tier_min` (`tenant_id`, `price_list_item_id`, `min_quantity`),
  KEY `idx_price_tier_resolve` (`tenant_id`, `price_list_item_id`, `min_quantity`, `max_quantity`),
  CONSTRAINT `fk_price_tiers_item` FOREIGN KEY (`price_list_item_id`) REFERENCES `price_list_items` (`price_list_item_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_variants` (
  `variant_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `parent_product_id` INT NOT NULL,
  `child_product_id` INT NOT NULL,
  `sku` VARCHAR(100) NOT NULL,
  `attribute_values` JSON NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`variant_id`),
  UNIQUE KEY `uq_product_variant_sku` (`tenant_id`, `sku`),
  UNIQUE KEY `uq_product_variant_child` (`tenant_id`, `parent_product_id`, `child_product_id`),
  KEY `idx_product_variants_parent` (`tenant_id`, `parent_product_id`, `is_active`),
  CONSTRAINT `fk_product_variants_parent` FOREIGN KEY (`parent_product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_product_variants_child` FOREIGN KEY (`child_product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_kit_components` (
  `kit_component_id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `kit_product_id` INT NOT NULL,
  `component_product_id` INT NOT NULL,
  `quantity` DECIMAL(14,3) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`kit_component_id`),
  UNIQUE KEY `uq_product_kit_component` (`tenant_id`, `kit_product_id`, `component_product_id`),
  KEY `idx_product_kit` (`tenant_id`, `kit_product_id`),
  CONSTRAINT `fk_product_kit_parent` FOREIGN KEY (`kit_product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_product_kit_component` FOREIGN KEY (`component_product_id`) REFERENCES `products` (`product_id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_product_kit_quantity` CHECK (`quantity` > 0),
  CONSTRAINT `chk_product_kit_not_self` CHECK (`kit_product_id` <> `component_product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
