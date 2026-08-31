-- Auth tables for Kynetropo ERP
-- Run this in phpMyAdmin ONCE per new client database
-- This creates all tables required for login/auth to work

-- Users table (admin login)
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(15) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `user_type` enum('customer','dealer','admin') NOT NULL DEFAULT 'customer',
  `company_name` varchar(150) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `state` varchar(50) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `gst_number` varchar(20) DEFAULT NULL,
  `udyam_number` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_active` tinyint(1) DEFAULT 1,
  `approval_status` enum('pending','approved','rejected') DEFAULT 'approved',
  `approved_at` timestamp NULL DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `staff_role` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  KEY `idx_users_tenant` (`tenant_id`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Revoked tokens (for logout)
CREATE TABLE IF NOT EXISTS `revoked_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token_hash` varchar(64) NOT NULL,
  `expired_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token_hash` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refresh tokens (for token rotation)
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_token_hash` (`token_hash`),
  KEY `idx_refresh_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OTP verifications (for password reset)
CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `otp_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `identifier` varchar(120) NOT NULL,
  `identifier_type` varchar(10) NOT NULL,
  `otp_code` varchar(6) NOT NULL,
  `purpose` varchar(40) NOT NULL,
  `is_used` tinyint(1) DEFAULT 0,
  `verified_at` datetime DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`otp_id`),
  KEY `idx_otp_identifier` (`identifier`, `purpose`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate limits (for API protection)
CREATE TABLE IF NOT EXISTS `rate_limits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ip` varchar(45) NOT NULL,
  `bucket` varchar(30) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_rate_ip_bucket` (`ip`, `bucket`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Settings table (for company profile, app config)
CREATE TABLE IF NOT EXISTS `settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `setting_key` varchar(80) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_t_key` (`tenant_id`, `setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit log
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(80) NOT NULL,
  `table_name` varchar(60) DEFAULT NULL,
  `record_id` int(11) DEFAULT NULL,
  `old_value` text DEFAULT NULL,
  `new_value` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_tenant` (`tenant_id`),
  KEY `idx_audit_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user
-- The hash below is for the password "password" (standard test hash)
-- ALWAYS generate a real password after import:
--   HASH=$(php -r "echo password_hash('YourPassword', PASSWORD_BCRYPT, ['cost'=>12]);")
--   mysql -u <user> -p'<pass>' <db> -e "UPDATE users SET password_hash='$HASH', email='admin@client.com' WHERE user_type='admin';"
INSERT IGNORE INTO `users`
  (`name`, `email`, `phone`, `password_hash`, `user_type`, `is_active`, `approval_status`, `tenant_id`)
VALUES
  ('Admin', 'admin@client.com', '9999999999',
   '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uXttdWO6y',
   'admin', 1, 'approved', 1);

-- Insert default settings
INSERT IGNORE INTO `settings` (`tenant_id`, `setting_key`, `setting_value`) VALUES
  (1, 'company_name', 'My Company'),
  (1, 'gst_rate', '18'),
  (1, 'currency', 'INR');
