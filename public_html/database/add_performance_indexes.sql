-- Performance indexes for the revenue / P&L / dashboard queries.
-- Run after every table/column migration, especially add_invoice_payment_status.sql.
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_payment_created') = 0,
  'ALTER TABLE `orders` ADD INDEX `idx_orders_payment_created` (`payment_status`, `created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND INDEX_NAME = 'idx_invoices_payment_order_created') = 0,
  'ALTER TABLE `invoices` ADD INDEX `idx_invoices_payment_order_created` (`payment_status`, `order_id`, `created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'invoices' AND INDEX_NAME = 'idx_invoices_created') = 0,
  'ALTER TABLE `invoices` ADD INDEX `idx_invoices_created` (`created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_created') = 0,
  'ALTER TABLE `users` ADD INDEX `idx_users_created` (`created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'queries' AND INDEX_NAME = 'idx_queries_created') = 0,
  'ALTER TABLE `queries` ADD INDEX `idx_queries_created` (`created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'quotes' AND INDEX_NAME = 'idx_quotes_created') = 0,
  'ALTER TABLE `quotes` ADD INDEX `idx_quotes_created` (`created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'chat_messages' AND INDEX_NAME = 'idx_chat_session_created') = 0,
  'ALTER TABLE `chat_messages` ADD INDEX `idx_chat_session_created` (`session_id`, `created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
