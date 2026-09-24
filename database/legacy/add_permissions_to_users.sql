-- Add permissions column to users table for invoice module staff access control
-- Run AFTER: auth_tables.sql

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `permissions` JSON DEFAULT NULL
              COMMENT 'Invoice module permission keys as JSON array';
