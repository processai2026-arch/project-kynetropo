-- Invoicing module completion: terms & conditions persistence + credit notes.
-- Every new table is tenant-scoped (tenant_id INT NOT NULL + index), matching the
-- multi-tenant pattern introduced by database/migrations/001_add_tenant_id.sql.
-- Run this once against the application database (see database/migrate.php for
-- the standard migration runner used by this project). Statements are guarded
-- (CREATE TABLE IF NOT EXISTS / conditional ALTER) so it is safe to re-run.

-- ── 1. Persist invoice Terms & Conditions on the invoice record ────────────
-- The frontend (Invoices.tsx) already edits this field but previously only
-- cached it in localStorage. Adding the column lets the API store/return it
-- per-invoice, like every other PDF-detail field (invoice_date, ship_to, etc).
ALTER TABLE `invoices`
  ADD COLUMN `terms_and_conditions` TEXT NULL;

-- ── 2. Credit notes ──────────────────────────────────────────────────────
-- A credit note corrects/reduces a previously issued invoice (return, pricing
-- error, goodwill adjustment, etc). It is linked to exactly one invoice and
-- reduces that invoice's effective receivable. Status lifecycle:
--   Draft     — being prepared, not yet applied
--   Issued    — finalized and reduces the invoice balance
--   Cancelled — voided, no financial effect
CREATE TABLE IF NOT EXISTS `credit_notes` (
  `credit_note_id`   INT NOT NULL AUTO_INCREMENT,
  `tenant_id`        INT NOT NULL,
  `credit_note_number` VARCHAR(50) NOT NULL,
  `invoice_id`       INT NOT NULL,
  `credit_note_date` DATE NOT NULL,
  `reason`           VARCHAR(255) NULL,
  `notes`            TEXT NULL,
  `subtotal`         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `gst_amount`       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cgst_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `sgst_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `igst_amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total`            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status`           ENUM('Draft','Issued','Cancelled') NOT NULL DEFAULT 'Draft',
  `created_by`       INT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`credit_note_id`),
  KEY `idx_credit_notes_tenant` (`tenant_id`),
  KEY `idx_credit_notes_invoice` (`tenant_id`, `invoice_id`),
  KEY `idx_credit_notes_status` (`tenant_id`, `status`),
  UNIQUE KEY `uq_credit_notes_number` (`tenant_id`, `credit_note_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `credit_note_items` (
  `item_id`        INT NOT NULL AUTO_INCREMENT,
  `tenant_id`      INT NOT NULL,
  `credit_note_id` INT NOT NULL,
  `description`    VARCHAR(255) NOT NULL,
  `hsn_code`       VARCHAR(20) NULL,
  `quantity`       DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  `unit`           VARCHAR(50) NULL DEFAULT 'Nos',
  `unit_price`     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `gst_rate`       DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `line_total`     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `sort_order`     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`item_id`),
  KEY `idx_credit_note_items_tenant` (`tenant_id`),
  KEY `idx_credit_note_items_note` (`tenant_id`, `credit_note_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
