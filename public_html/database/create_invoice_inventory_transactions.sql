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
  KEY `idx_inv_tx2_tenant`   (`tenant_id`),
  KEY `idx_inv_tx2_product`  (`tenant_id`, `product_id`),
  KEY `idx_inv_tx2_invoice`  (`invoice_id`),
  CONSTRAINT `fk_inv_tx2_product` FOREIGN KEY (`product_id`) REFERENCES `invoice_products` (`product_id`),
  CONSTRAINT `fk_inv_tx2_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `scan_invoices` (`invoice_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
