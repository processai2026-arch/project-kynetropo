-- Advanced inventory tracking and transfer orders.
-- Run after create_smart_inventory.sql and the tenant migration.
-- This is additive: existing balances, movements, GRNs, and allocation tables are unchanged.

ALTER TABLE `inventory_products`
  ADD COLUMN `tracking_type` varchar(10) NOT NULL DEFAULT 'NONE'
    COMMENT 'NONE | BATCH | SERIAL' AFTER `hsn_code`,
  ADD COLUMN `requires_expiry` tinyint(1) NOT NULL DEFAULT 0 AFTER `tracking_type`;

CREATE TABLE IF NOT EXISTS `inventory_stock_items` (
  `stock_item_id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `inv_product_id` int(11) NOT NULL,
  `zone_id` int(11) NOT NULL,
  `receipt_movement_id` int(11) DEFAULT NULL,
  `batch_number` varchar(80) DEFAULT NULL,
  `serial_number` varchar(120) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `barcode` varchar(160) DEFAULT NULL,
  `quantity` decimal(14,3) NOT NULL DEFAULT 0.000,
  `status` varchar(15) NOT NULL DEFAULT 'AVAILABLE'
    COMMENT 'AVAILABLE | IN_TRANSIT | CONSUMED | DAMAGED',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`stock_item_id`),
  UNIQUE KEY `uq_inv_stock_item_barcode` (`tenant_id`, `barcode`),
  UNIQUE KEY `uq_inv_stock_item_serial` (`tenant_id`, `serial_number`),
  KEY `idx_inv_stock_item_product_zone` (`tenant_id`, `inv_product_id`, `zone_id`, `status`),
  KEY `idx_inv_stock_item_batch` (`tenant_id`, `batch_number`),
  KEY `idx_inv_stock_item_expiry` (`tenant_id`, `expiry_date`),
  KEY `idx_inv_stock_item_receipt` (`tenant_id`, `receipt_movement_id`),
  CONSTRAINT `fk_inv_stock_item_product` FOREIGN KEY (`inv_product_id`) REFERENCES `inventory_products` (`inv_product_id`),
  CONSTRAINT `fk_inv_stock_item_zone` FOREIGN KEY (`zone_id`) REFERENCES `inventory_zones` (`zone_id`),
  CONSTRAINT `fk_inv_stock_item_receipt` FOREIGN KEY (`receipt_movement_id`) REFERENCES `inventory_stock_movements` (`movement_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_transfer_orders` (
  `transfer_order_id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `transfer_number` varchar(40) NOT NULL,
  `from_zone_id` int(11) NOT NULL,
  `to_zone_id` int(11) NOT NULL,
  `status` varchar(15) NOT NULL DEFAULT 'CREATED'
    COMMENT 'CREATED | DISPATCHED | RECEIVED | CANCELLED',
  `idempotency_key` varchar(100) DEFAULT NULL,
  `remarks` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `dispatched_by` int(11) DEFAULT NULL,
  `received_by` int(11) DEFAULT NULL,
  `dispatched_at` datetime DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`transfer_order_id`),
  UNIQUE KEY `uq_inv_transfer_number` (`tenant_id`, `transfer_number`),
  UNIQUE KEY `uq_inv_transfer_idempotency` (`tenant_id`, `idempotency_key`),
  KEY `idx_inv_transfer_status` (`tenant_id`, `status`, `created_at`),
  KEY `idx_inv_transfer_zones` (`tenant_id`, `from_zone_id`, `to_zone_id`),
  CONSTRAINT `fk_inv_transfer_from_zone` FOREIGN KEY (`from_zone_id`) REFERENCES `inventory_zones` (`zone_id`),
  CONSTRAINT `fk_inv_transfer_to_zone` FOREIGN KEY (`to_zone_id`) REFERENCES `inventory_zones` (`zone_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_transfer_order_items` (
  `transfer_item_id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `transfer_order_id` int(11) NOT NULL,
  `inv_product_id` int(11) NOT NULL,
  `requested_quantity` decimal(14,3) NOT NULL,
  `dispatched_quantity` decimal(14,3) NOT NULL DEFAULT 0.000,
  `received_quantity` decimal(14,3) NOT NULL DEFAULT 0.000,
  `batch_number` varchar(80) DEFAULT NULL,
  `serial_number` varchar(120) DEFAULT NULL,
  `barcode` varchar(160) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`transfer_item_id`),
  KEY `idx_inv_transfer_item_order` (`tenant_id`, `transfer_order_id`),
  KEY `idx_inv_transfer_item_product` (`tenant_id`, `inv_product_id`),
  CONSTRAINT `fk_inv_transfer_item_order` FOREIGN KEY (`transfer_order_id`) REFERENCES `inventory_transfer_orders` (`transfer_order_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_transfer_item_product` FOREIGN KEY (`inv_product_id`) REFERENCES `inventory_products` (`inv_product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_transfer_allocations` (
  `transfer_allocation_id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `transfer_item_id` int(11) NOT NULL,
  `stock_item_id` int(11) NOT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `received_quantity` decimal(14,3) NOT NULL DEFAULT 0.000,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`transfer_allocation_id`),
  KEY `idx_inv_transfer_alloc_item` (`tenant_id`, `transfer_item_id`),
  KEY `idx_inv_transfer_alloc_stock` (`tenant_id`, `stock_item_id`),
  CONSTRAINT `fk_inv_transfer_alloc_item` FOREIGN KEY (`transfer_item_id`) REFERENCES `inventory_transfer_order_items` (`transfer_item_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_transfer_alloc_stock` FOREIGN KEY (`stock_item_id`) REFERENCES `inventory_stock_items` (`stock_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
