CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `po_id` int(11) NOT NULL AUTO_INCREMENT,
  `po_number` varchar(30) NOT NULL,
  `vendor_id` int(11) NOT NULL,
  `pr_id` int(11) DEFAULT NULL,
  `order_date` date NOT NULL,
  `expected_date` date DEFAULT NULL,
  `seller_state` varchar(80) DEFAULT NULL,
  `vendor_state` varchar(80) DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0,
  `tax_amount` decimal(12,2) NOT NULL DEFAULT 0,
  `other_charges` decimal(12,2) NOT NULL DEFAULT 0,
  `total` decimal(12,2) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `payment_status` varchar(20) NOT NULL DEFAULT 'unpaid',
  `notes` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `billed_expense_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`po_id`),
  UNIQUE KEY `uq_po_number` (`po_number`),
  KEY `idx_po_vendor` (`vendor_id`),
  KEY `idx_po_pr` (`pr_id`),
  KEY `idx_po_status` (`status`),
  KEY `idx_po_created` (`created_at`),
  CONSTRAINT `fk_po_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`vendor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `item_id` int(11) NOT NULL AUTO_INCREMENT,
  `po_id` int(11) NOT NULL,
  `description` varchar(255) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `hsn_code` varchar(20) DEFAULT NULL,
  `quantity` decimal(12,3) NOT NULL DEFAULT 0,
  `received_qty` decimal(12,3) NOT NULL DEFAULT 0,
  `unit` varchar(20) NOT NULL DEFAULT 'Nos',
  `unit_price` decimal(12,2) NOT NULL DEFAULT 0,
  `gst_rate` decimal(5,2) NOT NULL DEFAULT 0,
  `line_total` decimal(12,2) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`item_id`),
  KEY `idx_poi_po` (`po_id`),
  KEY `idx_poi_product` (`product_id`),
  CONSTRAINT `fk_poi_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`po_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `goods_receipts` (
  `grn_id` int(11) NOT NULL AUTO_INCREMENT,
  `grn_number` varchar(30) NOT NULL,
  `po_id` int(11) NOT NULL,
  `received_on` date NOT NULL,
  `received_by` int(11) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'posted',
  `notes` varchar(500) DEFAULT NULL,
  `voided_by` int(11) DEFAULT NULL,
  `voided_at` datetime DEFAULT NULL,
  `void_reason` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`grn_id`),
  UNIQUE KEY `uq_grn_number` (`grn_number`),
  KEY `idx_grn_po` (`po_id`),
  KEY `idx_grn_status` (`status`),
  CONSTRAINT `fk_grn_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`po_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `goods_receipt_items` (
  `item_id` int(11) NOT NULL AUTO_INCREMENT,
  `grn_id` int(11) NOT NULL,
  `po_item_id` int(11) NOT NULL,
  `quantity` decimal(12,3) NOT NULL DEFAULT 0,
  `unit_cost` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`item_id`),
  KEY `idx_grni_grn` (`grn_id`),
  KEY `idx_grni_po_item` (`po_item_id`),
  CONSTRAINT `fk_grni_grn` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipts` (`grn_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_locations` (
  `location_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`location_id`),
  KEY `idx_inventory_locations_default` (`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `inventory_locations` (`name`, `is_default`, `is_active`)
SELECT 'Main Store', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `inventory_locations` WHERE `is_default` = 1);

CREATE TABLE IF NOT EXISTS `stock_items` (
  `stock_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `on_hand` decimal(14,3) NOT NULL DEFAULT 0,
  `reorder_level` decimal(14,3) NOT NULL DEFAULT 0,
  `avg_cost` decimal(12,2) NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`stock_id`),
  UNIQUE KEY `uq_stock_product_loc` (`product_id`, `location_id`),
  KEY `idx_stock_low` (`on_hand`),
  KEY `idx_stock_location` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stock_movements` (
  `movement_id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `location_id` int(11) NOT NULL,
  `direction` varchar(3) NOT NULL,
  `quantity` decimal(14,3) NOT NULL,
  `unit_cost` decimal(12,2) DEFAULT NULL,
  `ref_type` varchar(20) NOT NULL,
  `ref_id` int(11) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`movement_id`),
  KEY `idx_mov_product_date` (`product_id`, `created_at`),
  KEY `idx_mov_ref` (`ref_type`, `ref_id`),
  KEY `idx_mov_location` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
