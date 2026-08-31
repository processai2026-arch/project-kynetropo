-- Krish Agencies: machines table
-- Run AFTER create_customers.sql

CREATE TABLE IF NOT EXISTS `machines` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `machine_id` varchar(30) NOT NULL COMMENT 'Human-readable code e.g. KA-001',
  `model` varchar(150) NOT NULL,
  `category` varchar(80) DEFAULT NULL,
  `customer_id` int(11) NOT NULL,
  `location_name` varchar(150) NOT NULL,
  `address` text DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `geofence_radius_m` int(11) NOT NULL DEFAULT 100,
  `installed_date` date DEFAULT NULL,
  `warranty_expiry` date DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_machine_id_tenant` (`tenant_id`, `machine_id`),
  KEY `idx_machines_tenant` (`tenant_id`),
  KEY `idx_machines_customer` (`customer_id`),
  CONSTRAINT `fk_machines_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
