-- Invoice product catalog — separate from the main products table
-- Run once on the database

CREATE TABLE IF NOT EXISTS `invoice_products` (
  `id`          INT(11)        NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(200)   NOT NULL,
  `hsn_code`    VARCHAR(20)    DEFAULT NULL,
  `unit_price`  DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  `gst_rate`    TINYINT(3)     NOT NULL DEFAULT 18,
  `unit`        VARCHAR(50)    DEFAULT NULL,
  `created_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invoice_product_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
