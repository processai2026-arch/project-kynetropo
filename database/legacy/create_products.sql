-- Krish Agencies: products (consumables catalog)
-- Run AFTER auth_tables.sql

CREATE TABLE IF NOT EXISTS `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `name` varchar(150) NOT NULL,
  `sku` varchar(60) NOT NULL,
  `category` varchar(80) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `unit` varchar(30) DEFAULT 'Piece',
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `stock_qty` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_sku_tenant` (`tenant_id`, `sku`),
  KEY `idx_products_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
