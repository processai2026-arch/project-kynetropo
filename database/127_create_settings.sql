-- Settings table: key-value store per tenant.
-- Used by AdminSettingsController and throughout the API for company config,
-- notification toggles, document numbering, attendance cutoffs, etc.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `settings` (
  `id`            INT(11)      NOT NULL AUTO_INCREMENT,
  `tenant_id`     INT(11)      NOT NULL DEFAULT 1,
  `setting_key`   VARCHAR(80)  NOT NULL,
  `setting_value` TEXT         DEFAULT NULL,
  `updated_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_t_key` (`tenant_id`, `setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
