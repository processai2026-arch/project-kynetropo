-- Add damaged_stock and input_gst columns to invoice_products
-- Run AFTER: create_invoice_products.sql

ALTER TABLE `invoice_products`
  ADD COLUMN IF NOT EXISTS `damaged_stock`    INT NOT NULL DEFAULT 0
              COMMENT 'Qty in damaged condition, separate from active stock'
              AFTER `current_stock`,
  ADD COLUMN IF NOT EXISTS `input_gst_rate`   DECIMAL(5,2) DEFAULT 0.00
              COMMENT 'ITC claimable GST rate %'
              AFTER `hsn_code`,
  ADD COLUMN IF NOT EXISTS `input_gst_amount` DECIMAL(12,2) DEFAULT 0.00
              COMMENT 'ITC claimable amount ₹'
              AFTER `input_gst_rate`;
