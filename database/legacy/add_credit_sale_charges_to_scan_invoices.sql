-- Add credit_sale, shipping_charges, commission_amount columns to scan_invoices
-- invoice_type and is_damaged already added by add_invoice_type_to_scan_invoices.sql
-- Run AFTER: add_invoice_type_to_scan_invoices.sql

ALTER TABLE `scan_invoices`
  ADD COLUMN IF NOT EXISTS `is_credit_sale`    TINYINT(1) NOT NULL DEFAULT 0
              COMMENT 'When 1, approval creates an outstanding_entries receivable'
              AFTER `is_damaged`,
  ADD COLUMN IF NOT EXISTS `credit_days`       INT NOT NULL DEFAULT 30
              COMMENT 'Payment due in N days from invoice_date'
              AFTER `is_credit_sale`,
  ADD COLUMN IF NOT EXISTS `shipping_charges`  DECIMAL(12,2) NOT NULL DEFAULT 0.00
              COMMENT 'Extracted by AI or entered manually'
              AFTER `total_amount`,
  ADD COLUMN IF NOT EXISTS `commission_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00
              COMMENT 'Marketplace commission extracted by AI'
              AFTER `shipping_charges`;

-- Indexes for new columns
ALTER TABLE `scan_invoices`
  ADD KEY IF NOT EXISTS `idx_scan_inv_tenant_credit` (`tenant_id`, `is_credit_sale`);
