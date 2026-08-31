CREATE TABLE IF NOT EXISTS `invoice_notifications` (
  `notification_id` INT(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`       INT NOT NULL,
  `type`            ENUM('low_stock','duplicate_invoice','gst_mismatch','invoice_error','ai_low_confidence','new_sales_record','inventory_warning','gst_due') NOT NULL,
  `title`           VARCHAR(255) NOT NULL,
  `message`         TEXT NOT NULL,
  `data`            JSON DEFAULT NULL,
  `is_read`         TINYINT(1) NOT NULL DEFAULT 0,
  `read_at`         DATETIME DEFAULT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`),
  KEY `idx_inv_notif_tenant`      (`tenant_id`),
  KEY `idx_inv_notif_tenant_read` (`tenant_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
