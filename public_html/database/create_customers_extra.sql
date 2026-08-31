-- Customers / CRM module completion (P1 gap fixes from docs/MODULE_GAP_ANALYSIS.md, §4).
-- Every new table is tenant-scoped (tenant_id INT NOT NULL + index), matching the
-- multi-tenant pattern used by database/create_invoicing_extra.sql and
-- database/create_dealer_customer_intelligence.sql. Statements are guarded
-- (CREATE TABLE IF NOT EXISTS / ADD COLUMN) so this file is safe
-- to re-run. Run this once against the application database (see
-- database/migrate.php for the standard migration runner used by this project).
--
-- Fixes:
--  1. Admin-initiated password reset needs a one-shot generated credential
--     event log (audit trail of who reset what, and whether the email send
--     actually succeeded) — separate from the existing `audit_log` table so
--     support/ops can query "who reset this customer's password and when"
--     without scanning the generic audit feed.
--  2. Customer health / segmentation score (recency, frequency, monetary,
--     overdue) computed from real order + invoice history, persisted per
--     customer so the admin customer list can render it without recomputing
--     on every page load. Recomputed on demand via
--     AdminUserController::recomputeHealth / customerHealth.

-- ── 1. Password reset audit trail ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `customer_password_resets` (
  `reset_id`     INT NOT NULL AUTO_INCREMENT,
  `tenant_id`    INT NOT NULL,
  `user_id`      INT NOT NULL,
  `reset_by`     INT NULL,
  `email_sent`   TINYINT(1) NOT NULL DEFAULT 0,
  `delivery_method` VARCHAR(20) NOT NULL DEFAULT 'email',
  `ip_address`   VARCHAR(45) NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reset_id`),
  KEY `idx_cpr_tenant` (`tenant_id`),
  KEY `idx_cpr_user` (`user_id`),
  KEY `fk_cpr_user` (`user_id`),
  KEY `fk_cpr_reset_by` (`reset_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Customer health / segmentation score ─────────────────────────────────
-- One row per (tenant, customer). Recomputed via AdminUserController and
-- read back on the customer list/detail so the owner sees who needs
-- attention without manually cross-referencing orders/invoices.
--
-- Scoring model (0-100, higher = healthier):
--   recency_score    (0-30) — days since last order, decayed
--   frequency_score  (0-25) — order count over the trailing 12 months
--   monetary_score   (0-25) — total spend percentile within the tenant
--   payment_score    (0-20) — penalised by overdue invoice balance/age
--   health_score = recency + frequency + monetary + payment
--   segment: 'champion' | 'loyal' | 'at_risk' | 'new' | 'dormant'
--   is_at_risk / is_high_value are precomputed booleans for fast list filters.
CREATE TABLE IF NOT EXISTS `customer_health_scores` (
  `customer_id`       INT NOT NULL,
  `tenant_id`         INT NOT NULL,
  `recency_score`     DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `frequency_score`   DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `monetary_score`    DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `payment_score`     DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `health_score`      DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `segment`            VARCHAR(20) NOT NULL DEFAULT 'new',
  `is_at_risk`         TINYINT(1) NOT NULL DEFAULT 0,
  `is_high_value`      TINYINT(1) NOT NULL DEFAULT 0,
  `total_orders`       INT NOT NULL DEFAULT 0,
  `orders_last_12m`    INT NOT NULL DEFAULT 0,
  `total_spend`        DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `avg_order_value`    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `overdue_amount`     DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `overdue_invoices`   INT NOT NULL DEFAULT 0,
  `max_days_overdue`   INT NOT NULL DEFAULT 0,
  `last_order_at`      DATETIME NULL DEFAULT NULL,
  `days_since_last_order` INT NULL DEFAULT NULL,
  `computed_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`),
  KEY `idx_chs_tenant` (`tenant_id`),
  KEY `idx_chs_segment` (`tenant_id`, `segment`),
  KEY `idx_chs_at_risk` (`tenant_id`, `is_at_risk`),
  KEY `idx_chs_high_value` (`tenant_id`, `is_high_value`),
  KEY `idx_chs_score` (`tenant_id`, `health_score`),
  KEY `fk_chs_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. Last-order convenience columns on users ──────────────────────────────
-- AdminUserController::index currently aggregates total_orders/total_spent via
-- a JOIN but has no fast last-order lookup. Rather than computing last_order_at
-- with a correlated subquery on every list page load, we keep it denormalised
-- here and refresh it together with the health score (same recompute pass).
ALTER TABLE `users`
  ADD COLUMN `last_order_at` DATETIME NULL DEFAULT NULL AFTER `udyam_number`;
