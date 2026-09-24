ALTER TABLE `scan_invoices`
  ADD COLUMN `invoice_type` ENUM('sale','purchase','return','commission') NOT NULL DEFAULT 'sale' AFTER `marketplace`,
  ADD COLUMN `is_damaged`   TINYINT(1) NOT NULL DEFAULT 0 AFTER `invoice_type`;

ALTER TABLE `scan_invoices`
  ADD KEY `idx_scan_inv_tenant_type` (`tenant_id`, `invoice_type`);
