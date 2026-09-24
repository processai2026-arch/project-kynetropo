-- Procurement module completion: vendor bills (real supplier-invoice entity),
-- three-way match support, and PO PDF/email delivery tracking.
--
-- Safe to run repeatedly: CREATE TABLE IF NOT EXISTS + best-effort ALTERs.
-- On an already-migrated database, ignore any duplicate-column errors from the
-- ALTER statements below and continue with the remaining lines.

-- ── Vendor Bills (replaces booking PO cost as a generic expense) ────────────
CREATE TABLE IF NOT EXISTS `vendor_bills` (
  `bill_id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `bill_number` varchar(40) NOT NULL,
  `vendor_invoice_number` varchar(80) DEFAULT NULL,
  `vendor_id` int(11) NOT NULL,
  `po_id` int(11) DEFAULT NULL,
  `bill_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0,
  `tax_amount` decimal(12,2) NOT NULL DEFAULT 0,
  `other_charges` decimal(12,2) NOT NULL DEFAULT 0,
  `total` decimal(12,2) NOT NULL DEFAULT 0,
  `amount_paid` decimal(12,2) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `payment_status` varchar(20) NOT NULL DEFAULT 'unpaid',
  `notes` varchar(500) DEFAULT NULL,
  `expense_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`bill_id`),
  UNIQUE KEY `uq_vendor_bill_tenant_number` (`tenant_id`, `bill_number`),
  KEY `idx_vendor_bills_vendor` (`vendor_id`),
  KEY `idx_vendor_bills_po` (`po_id`),
  KEY `idx_vendor_bills_status` (`status`),
  KEY `idx_vendor_bills_tenant` (`tenant_id`),
  KEY `fk_vendor_bills_vendor` (`vendor_id`),
  KEY `fk_vendor_bills_po` (`po_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vendor_bill_items` (
  `item_id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `bill_id` int(11) NOT NULL,
  `po_item_id` int(11) DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `quantity` decimal(12,3) NOT NULL DEFAULT 0,
  `unit` varchar(20) NOT NULL DEFAULT 'Nos',
  `unit_price` decimal(12,2) NOT NULL DEFAULT 0,
  `gst_rate` decimal(5,2) NOT NULL DEFAULT 0,
  `line_total` decimal(12,2) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`item_id`),
  KEY `idx_vbi_bill` (`bill_id`),
  KEY `idx_vbi_po_item` (`po_item_id`),
  KEY `idx_vbi_tenant` (`tenant_id`),
  KEY `fk_vbi_bill` (`bill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Join table so a single bill can cite multiple GRNs (and a GRN can be billed
-- across multiple partial bills) without overloading vendor_bills.po_id.
CREATE TABLE IF NOT EXISTS `vendor_bill_grns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `bill_id` int(11) NOT NULL,
  `grn_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendor_bill_grn` (`bill_id`, `grn_id`),
  KEY `idx_vbg_grn` (`grn_id`),
  KEY `idx_vbg_tenant` (`tenant_id`),
  KEY `fk_vbg_bill` (`bill_id`),
  KEY `fk_vbg_grn` (`grn_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── PO PDF / email delivery tracking ─────────────────────────────────────────
-- Additive ALTERs. On an already migrated database, skip any duplicate-column
-- errors and continue with the remaining lines.
ALTER TABLE `purchase_orders`
  ADD COLUMN `delivery_status` VARCHAR(20) NOT NULL DEFAULT 'not_sent' AFTER `billed_expense_id`;

ALTER TABLE `purchase_orders`
  ADD COLUMN `delivered_to_email` VARCHAR(160) NULL AFTER `delivery_status`;

ALTER TABLE `purchase_orders`
  ADD COLUMN `delivered_at` DATETIME NULL AFTER `delivered_to_email`;

ALTER TABLE `purchase_orders`
  ADD COLUMN `delivery_attempts` INT(11) NOT NULL DEFAULT 0 AFTER `delivered_at`;
