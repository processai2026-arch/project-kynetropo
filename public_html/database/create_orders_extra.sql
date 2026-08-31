-- Orders module — P1 completion (tracking/cancellation persistence, legal state
-- machine support, order timeline/history, and read-only fulfilment helper).
--
-- Run this after the base schema. All statements are guarded
-- (ALTER ... ADD COLUMN / CREATE TABLE IF NOT EXISTS) so this file
-- is safe to run multiple times and on tenants that already have some of these
-- columns. Every new table carries tenant_id and is scoped accordingly by the
-- PHP models — see api/models/Order.php.
--
-- NOTE: `orders.tracking_number`, `orders.cancel_reason`, and `orders.refund_status`
-- already exist on the base `orders` table — this file does NOT recreate them.
-- It adds the remaining lifecycle fields (carrier, shipped/delivered/cancelled
-- timestamps, who cancelled) plus an audit-grade status timeline table.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. orders — additional tracking / cancellation lifecycle columns
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE `orders`
  ADD COLUMN `carrier`        varchar(100) DEFAULT NULL AFTER `tracking_number`,
  ADD COLUMN `shipped_at`     timestamp NULL DEFAULT NULL AFTER `carrier`,
  ADD COLUMN `delivered_at`   timestamp NULL DEFAULT NULL AFTER `shipped_at`,
  ADD COLUMN `cancelled_at`   timestamp NULL DEFAULT NULL AFTER `cancel_reason`,
  ADD COLUMN `cancelled_by`   int(11) DEFAULT NULL AFTER `cancelled_at`;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. order_status_history
--    Append-only audit trail of every order_status transition. Powers the
--    timeline shown in the admin UI. Tenant-scoped like every other table.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `order_status_history` (
  `history_id`   int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`    int(11) NOT NULL,
  `order_id`     int(11) NOT NULL,
  `from_status`  varchar(30) DEFAULT NULL,
  `to_status`    varchar(30) NOT NULL,
  `changed_by`   int(11) DEFAULT NULL COMMENT 'users.user_id of the admin who made the change; NULL for system/automated transitions',
  `note`         text DEFAULT NULL COMMENT 'cancel reason / tracking number / free-form context captured at transition time',
  `created_at`   timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`history_id`),
  KEY `idx_osh_tenant_order` (`tenant_id`, `order_id`),
  KEY `idx_osh_order_created` (`order_id`, `created_at`),
  KEY `fk_osh_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. order_notifications
--    Lightweight delivery log for the customer status-notification automation
--    (shipped/delivered emails sent via api/helpers/Mailer.php). Lets staff see
--    whether a customer update actually went out instead of assuming it did.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `order_notifications` (
  `notification_id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id`        int(11) NOT NULL,
  `order_id`         int(11) NOT NULL,
  `event`            varchar(30) NOT NULL COMMENT 'shipped | delivered',
  `recipient_email`  varchar(190) DEFAULT NULL,
  `status`           varchar(20) NOT NULL DEFAULT 'sent' COMMENT 'sent | failed | skipped',
  `created_at`       timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`notification_id`),
  KEY `idx_onotif_tenant_order` (`tenant_id`, `order_id`),
  KEY `fk_onotif_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
