SET @staff_role_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'staff_role'
);

SET @staff_role_column_sql = IF(
  @staff_role_column_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `staff_role` varchar(30) DEFAULT NULL AFTER `user_type`',
  'SELECT 1'
);

PREPARE staff_role_column_stmt FROM @staff_role_column_sql;
EXECUTE staff_role_column_stmt;
DEALLOCATE PREPARE staff_role_column_stmt;

SET @staff_role_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_staff_role'
);

SET @staff_role_index_sql = IF(
  @staff_role_index_exists = 0,
  'CREATE INDEX `idx_users_staff_role` ON `users` (`staff_role`)',
  'SELECT 1'
);

PREPARE staff_role_index_stmt FROM @staff_role_index_sql;
EXECUTE staff_role_index_stmt;
DEALLOCATE PREPARE staff_role_index_stmt;
