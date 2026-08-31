-- Smart Inventory Management — foundation schema (Prompt 1 / DB only).
-- Run after create_procurement_phase1.sql (vendors) and create_procurement_phase2_inventory.sql.
--
-- DESIGN NOTES (read before editing):
--   * This is a NEW, richer inventory layer that COEXISTS with the existing
--     stock_items / stock_movements / inventory_locations tables (used by
--     Inventory.php + AdminInventoryController). Nothing here drops or alters
--     those. A later prompt will bridge GRN/order flows into this layer.
--   * Conventions match the live Eco Sudar DB on purpose (NOT generic ERP):
--       - int(11) AUTO_INCREMENT primary keys (so FKs to products/users/etc. work)
--       - varchar status/type columns, validated in PHP (the codebase avoids ENUM
--         for app-controlled state so values can grow without ALTER TABLE; native
--         ENUM is only used on legacy core tables like products/orders/users)
--       - decimal(14,3) for quantities, decimal(12,2) for money (existing stock_* style)
--       - is_active / is_deleted tinyint(1) soft-state, NOT deleted_at
--       - datetime DEFAULT current_timestamp() [ON UPDATE ...] timestamps
--   * "Dealers" are NOT a separate table in Eco Sudar — they are users rows with
--     user_type='dealer'. Every dealer_id below therefore references users(user_id).
--   * FKs use RESTRICT (default) on masters and CASCADE only where a child row has
--     no meaning without its parent, mirroring purchase_order_items / grn_items.
--   * Allowed string values for status/type columns are documented in COMMENTs so
--     the PHP model and this file stay in sync.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. inventory_products
--    Inventory-specific master. Optionally maps to the legacy products table
--    (products.product_id) but can also hold raw materials / consumables that
--    were never sellable products — hence source_product_id is NULLable.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_products` (
  `inv_product_id`    int(11) NOT NULL AUTO_INCREMENT,
  `source_product_id` int(11) DEFAULT NULL COMMENT 'FK products.product_id when this maps to a sellable product; NULL for raw material/consumable',
  `name`              varchar(150) NOT NULL,
  `sku`               varchar(60) NOT NULL,
  `category`          varchar(100) DEFAULT NULL,
  `uom`               varchar(20) NOT NULL DEFAULT 'Nos' COMMENT 'unit of measure: kg, Nos, L, MT ...',
  `hsn_code`          varchar(20) DEFAULT NULL COMMENT 'GST HSN/SAC code (Indian compliance)',
  `reorder_level`     decimal(14,3) NOT NULL DEFAULT 0.000,
  `reorder_quantity`  decimal(14,3) NOT NULL DEFAULT 0.000,
  `standard_cost`     decimal(12,2) NOT NULL DEFAULT 0.00,
  `selling_price`     decimal(12,2) NOT NULL DEFAULT 0.00,
  `is_active`         tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted`        tinyint(1) NOT NULL DEFAULT 0 COMMENT 'soft delete, mirrors products.is_deleted',
  `created_by`        int(11) DEFAULT NULL COMMENT 'FK users.user_id',
  `created_at`        datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at`        datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`inv_product_id`),
  UNIQUE KEY `uq_inv_product_sku` (`sku`),
  KEY `idx_inv_product_source` (`source_product_id`),
  KEY `idx_inv_product_category` (`category`),
  KEY `idx_inv_product_active` (`is_active`, `is_deleted`),
  KEY `idx_inv_product_created_by` (`created_by`),
  CONSTRAINT `fk_inv_product_source` FOREIGN KEY (`source_product_id`) REFERENCES `products` (`product_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inv_product_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. inventory_zones
--    Logical zones within physical warehouses. zone_type drives business rules
--    later (e.g. DEALER_RESERVED stock is not "available", DAMAGED is written off).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_zones` (
  `zone_id`        int(11) NOT NULL AUTO_INCREMENT,
  `zone_name`      varchar(100) NOT NULL,
  `zone_code`      varchar(30) NOT NULL,
  `zone_type`      varchar(20) NOT NULL DEFAULT 'READY_STOCK'
                   COMMENT 'RAW_MATERIAL | PRODUCTION | READY_STOCK | DEALER_RESERVED | DAMAGED | EMERGENCY_BUFFER',
  `warehouse_location` varchar(150) DEFAULT NULL,
  `capacity`       decimal(14,3) NOT NULL DEFAULT 0.000 COMMENT '0 = unlimited/untracked',
  `is_active`      tinyint(1) NOT NULL DEFAULT 1,
  `created_at`     datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at`     datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`zone_id`),
  UNIQUE KEY `uq_zone_code` (`zone_code`),
  KEY `idx_zone_type` (`zone_type`),
  KEY `idx_zone_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. inventory_stock
--    Master on-hand balance, one row per (product, zone). available is stored
--    (current - reserved) so list/low-stock queries stay index-friendly rather
--    than computing it every read; the PHP service keeps it consistent on each
--    movement. health_score / is_low_stock are denormalized for fast dashboards.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_stock` (
  `stock_id`           int(11) NOT NULL AUTO_INCREMENT,
  `inv_product_id`     int(11) NOT NULL,
  `zone_id`            int(11) NOT NULL,
  `current_quantity`   decimal(14,3) NOT NULL DEFAULT 0.000,
  `reserved_quantity`  decimal(14,3) NOT NULL DEFAULT 0.000,
  `available_quantity` decimal(14,3) NOT NULL DEFAULT 0.000 COMMENT 'current - reserved, maintained by service layer',
  `last_movement_at`   datetime DEFAULT NULL,
  `health_score`       decimal(5,2) NOT NULL DEFAULT 100.00 COMMENT '0-100, computed (cover days vs reorder, ageing, damage)',
  `is_low_stock`       tinyint(1) NOT NULL DEFAULT 0 COMMENT 'auto-set when available <= product.reorder_level',
  `created_at`         datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at`         datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`stock_id`),
  UNIQUE KEY `uq_stock_product_zone` (`inv_product_id`, `zone_id`),
  KEY `idx_stock_zone` (`zone_id`),
  KEY `idx_stock_low` (`is_low_stock`),
  KEY `idx_stock_available` (`available_quantity`),
  CONSTRAINT `fk_stock_product` FOREIGN KEY (`inv_product_id`) REFERENCES `inventory_products` (`inv_product_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_stock_zone` FOREIGN KEY (`zone_id`) REFERENCES `inventory_zones` (`zone_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. inventory_stock_movements
--    Immutable ledger — the answer to "why did stock change / who caused it".
--    reference_type + reference_id is a polymorphic link to the originating doc
--    (no hard FK, since it can point at purchase_orders, orders, employees, etc.).
--    moved_by/approved_by reference users. Movements are never updated in place;
--    corrections are new ADJUSTMENT rows.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_stock_movements` (
  `movement_id`     int(11) NOT NULL AUTO_INCREMENT,
  `inv_product_id`  int(11) NOT NULL,
  `zone_id`         int(11) NOT NULL,
  `movement_type`   varchar(20) NOT NULL
                    COMMENT 'STOCK_IN | STOCK_OUT | TRANSFER | ADJUSTMENT | DAMAGE | RETURN | PRODUCTION_USE | DEALER_ALLOCATION | EMPLOYEE_ISSUE | EMERGENCY_USE',
  `quantity`        decimal(14,3) NOT NULL COMMENT 'always positive; movement_type sets direction',
  `unit_cost`       decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_value`     decimal(14,2) NOT NULL DEFAULT 0.00 COMMENT 'quantity * unit_cost, stored for fast valuation rollups',
  `reference_type`  varchar(30) DEFAULT NULL
                    COMMENT 'PURCHASE_ORDER | DEALER_ORDER | PRODUCTION_BATCH | EMPLOYEE_REQUEST | TRANSFER | MANUAL',
  `reference_id`    int(11) DEFAULT NULL COMMENT 'PK in the table named by reference_type (soft link, no FK)',
  `dealer_id`       int(11) DEFAULT NULL COMMENT 'FK users.user_id (user_type=dealer) for DEALER_ALLOCATION',
  `moved_by`        int(11) DEFAULT NULL COMMENT 'FK users.user_id',
  `approved_by`     int(11) DEFAULT NULL COMMENT 'FK users.user_id',
  `approval_status` varchar(15) NOT NULL DEFAULT 'APPROVED' COMMENT 'PENDING | APPROVED | REJECTED',
  `remarks`         varchar(500) DEFAULT NULL,
  `attachment_url`  varchar(500) DEFAULT NULL,
  `created_at`      datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`movement_id`),
  KEY `idx_mov_product_date` (`inv_product_id`, `created_at`),
  KEY `idx_mov_zone` (`zone_id`),
  KEY `idx_mov_type` (`movement_type`),
  KEY `idx_mov_reference` (`reference_type`, `reference_id`),
  KEY `idx_mov_dealer` (`dealer_id`),
  KEY `idx_mov_approval` (`approval_status`),
  KEY `idx_mov_moved_by` (`moved_by`),
  CONSTRAINT `fk_mov_product` FOREIGN KEY (`inv_product_id`) REFERENCES `inventory_products` (`inv_product_id`),
  CONSTRAINT `fk_mov_zone` FOREIGN KEY (`zone_id`) REFERENCES `inventory_zones` (`zone_id`),
  CONSTRAINT `fk_mov_dealer` FOREIGN KEY (`dealer_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mov_moved_by` FOREIGN KEY (`moved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_mov_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. inventory_reorder_suggestions
--    Output of the reorder intelligence. suggested_supplier_id references the
--    real procurement vendors table so a suggestion can convert to a PO later.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_reorder_suggestions` (
  `suggestion_id`         int(11) NOT NULL AUTO_INCREMENT,
  `inv_product_id`        int(11) NOT NULL,
  `current_stock`         decimal(14,3) NOT NULL DEFAULT 0.000,
  `reorder_level`         decimal(14,3) NOT NULL DEFAULT 0.000,
  `suggested_quantity`    decimal(14,3) NOT NULL DEFAULT 0.000,
  `suggested_supplier_id` int(11) DEFAULT NULL COMMENT 'FK vendors.vendor_id',
  `prediction_basis`      varchar(20) NOT NULL DEFAULT 'manual' COMMENT 'usage_trend | dealer_demand | manual',
  `status`                varchar(15) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING | ORDERED | DISMISSED',
  `created_at`            datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at`            datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`suggestion_id`),
  KEY `idx_reorder_product` (`inv_product_id`),
  KEY `idx_reorder_status` (`status`),
  KEY `idx_reorder_supplier` (`suggested_supplier_id`),
  CONSTRAINT `fk_reorder_product` FOREIGN KEY (`inv_product_id`) REFERENCES `inventory_products` (`inv_product_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reorder_supplier` FOREIGN KEY (`suggested_supplier_id`) REFERENCES `vendors` (`vendor_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. inventory_dealer_demand
--    Per-dealer, per-product consumption profile feeding reserve/reorder logic.
--    dealer_id → users(user_id). One live row per (dealer, product).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_dealer_demand` (
  `demand_id`                int(11) NOT NULL AUTO_INCREMENT,
  `dealer_id`                int(11) NOT NULL COMMENT 'FK users.user_id (user_type=dealer)',
  `inv_product_id`           int(11) NOT NULL,
  `avg_monthly_consumption`  decimal(14,3) NOT NULL DEFAULT 0.000,
  `last_order_quantity`      decimal(14,3) NOT NULL DEFAULT 0.000,
  `last_order_date`          date DEFAULT NULL,
  `predicted_next_order_date` date DEFAULT NULL,
  `suggested_reserve_qty`    decimal(14,3) NOT NULL DEFAULT 0.000,
  `confidence_score`         decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT '0-100',
  `created_at`               datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at`               datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`demand_id`),
  UNIQUE KEY `uq_demand_dealer_product` (`dealer_id`, `inv_product_id`),
  KEY `idx_demand_product` (`inv_product_id`),
  KEY `idx_demand_next_order` (`predicted_next_order_date`),
  CONSTRAINT `fk_demand_dealer` FOREIGN KEY (`dealer_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_demand_product` FOREIGN KEY (`inv_product_id`) REFERENCES `inventory_products` (`inv_product_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. inventory_approvals
--    Approval workflow attached to a movement. Kept separate from the movement
--    so a single high-value/damage movement can carry a full request→action
--    trail (who requested, who approved/rejected, when) without bloating the
--    ledger row. movement_id → inventory_stock_movements.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_approvals` (
  `approval_id`     int(11) NOT NULL AUTO_INCREMENT,
  `movement_id`     int(11) NOT NULL,
  `approval_type`   varchar(20) NOT NULL COMMENT 'HIGH_VALUE | DAMAGE_THRESHOLD | MANUAL_ADJUSTMENT | TRANSFER',
  `requested_by`    int(11) DEFAULT NULL COMMENT 'FK users.user_id',
  `approved_by`     int(11) DEFAULT NULL COMMENT 'FK users.user_id',
  `rejected_by`     int(11) DEFAULT NULL COMMENT 'FK users.user_id',
  `approval_status` varchar(15) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING | APPROVED | REJECTED',
  `remarks`         varchar(500) DEFAULT NULL,
  `created_at`      datetime NOT NULL DEFAULT current_timestamp(),
  `actioned_at`     datetime DEFAULT NULL,
  PRIMARY KEY (`approval_id`),
  KEY `idx_approval_movement` (`movement_id`),
  KEY `idx_approval_status` (`approval_status`),
  KEY `idx_approval_type` (`approval_type`),
  KEY `idx_approval_requested_by` (`requested_by`),
  CONSTRAINT `fk_approval_movement` FOREIGN KEY (`movement_id`) REFERENCES `inventory_stock_movements` (`movement_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_approval_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_approval_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_approval_rejected_by` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- 8. inventory_audit_log
--    Generic change journal for every inventory table. Mirrors the existing
--    attachments/import-job audit style. No FK on record_id (it spans tables);
--    table_name + record_id locate the affected row. old/new values are JSON
--    (MySQL 8 native JSON type).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_audit_log` (
  `audit_id`     int(11) NOT NULL AUTO_INCREMENT,
  `table_name`   varchar(64) NOT NULL,
  `record_id`    int(11) NOT NULL,
  `action_type`  varchar(20) NOT NULL COMMENT 'CREATE | UPDATE | DELETE | APPROVE | REJECT',
  `old_value`    json DEFAULT NULL,
  `new_value`    json DEFAULT NULL,
  `performed_by` int(11) DEFAULT NULL COMMENT 'FK users.user_id',
  `ip_address`   varchar(45) DEFAULT NULL COMMENT 'IPv4/IPv6',
  `created_at`   datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`audit_id`),
  KEY `idx_audit_table_record` (`table_name`, `record_id`),
  KEY `idx_audit_performed_by` (`performed_by`),
  KEY `idx_audit_created` (`created_at`),
  CONSTRAINT `fk_audit_performed_by` FOREIGN KEY (`performed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────────────────────────────────────────────
-- Seed: default zones (idempotent — only inserts a zone_code if missing).
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO `inventory_zones` (`zone_name`, `zone_code`, `zone_type`, `warehouse_location`)
SELECT * FROM (
  SELECT 'Raw Material Store' AS zn, 'ZN-RAW'  AS zc, 'RAW_MATERIAL'     AS zt, 'Main Plant' AS wl UNION ALL
  SELECT 'Production Floor',        'ZN-PROD',     'PRODUCTION',         'Main Plant' UNION ALL
  SELECT 'Ready Stock',             'ZN-READY',    'READY_STOCK',        'Main Plant' UNION ALL
  SELECT 'Dealer Reserved',         'ZN-DEALER',   'DEALER_RESERVED',    'Main Plant' UNION ALL
  SELECT 'Damaged / Scrap',         'ZN-DAMAGE',   'DAMAGED',            'Main Plant' UNION ALL
  SELECT 'Emergency Buffer',        'ZN-EMERG',    'EMERGENCY_BUFFER',   'Main Plant'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `inventory_zones` z WHERE z.`zone_code` = seed.zc);
