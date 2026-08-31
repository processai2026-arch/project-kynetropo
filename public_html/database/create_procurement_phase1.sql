CREATE TABLE IF NOT EXISTS `vendors` (
  `vendor_id` int(11) NOT NULL AUTO_INCREMENT,
  `vendor_code` varchar(30) DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `contact_name` varchar(120) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(120) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(80) DEFAULT NULL,
  `state` varchar(80) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `payment_terms` varchar(60) DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`vendor_id`),
  UNIQUE KEY `uq_vendor_code` (`vendor_code`),
  KEY `idx_vendors_active` (`is_active`),
  KEY `idx_vendors_name` (`name`),
  KEY `idx_vendors_gstin` (`gstin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_requests` (
  `pr_id` int(11) NOT NULL AUTO_INCREMENT,
  `pr_number` varchar(30) NOT NULL,
  `requested_by` int(11) DEFAULT NULL,
  `department` varchar(80) DEFAULT NULL,
  `need_by_date` date DEFAULT NULL,
  `priority` varchar(10) NOT NULL DEFAULT 'normal',
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `notes` varchar(500) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejected_by` int(11) DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`pr_id`),
  UNIQUE KEY `uq_pr_number` (`pr_number`),
  KEY `idx_pr_status` (`status`),
  KEY `idx_pr_created` (`created_at`),
  KEY `idx_pr_requested_by` (`requested_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `purchase_request_items` (
  `item_id` int(11) NOT NULL AUTO_INCREMENT,
  `pr_id` int(11) NOT NULL,
  `description` varchar(255) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `quantity` decimal(12,3) NOT NULL DEFAULT 0,
  `unit` varchar(20) NOT NULL DEFAULT 'Nos',
  `est_unit_price` decimal(12,2) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`item_id`),
  KEY `idx_pri_pr` (`pr_id`),
  KEY `idx_pri_product` (`product_id`),
  CONSTRAINT `fk_pri_pr`
    FOREIGN KEY (`pr_id`) REFERENCES `purchase_requests` (`pr_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
