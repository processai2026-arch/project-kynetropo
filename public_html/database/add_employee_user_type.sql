-- Krish Agencies: add 'employee' to users.user_type enum
-- Run AFTER auth_tables.sql

ALTER TABLE `users`
  MODIFY COLUMN `user_type` enum('customer','dealer','admin','employee') NOT NULL DEFAULT 'customer';
