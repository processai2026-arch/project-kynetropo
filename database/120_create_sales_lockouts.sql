-- Sales lockouts — "Challenge Accepted" has a cost.
--
-- When a challenge someone accepted runs past its deadline unfinished, their
-- access to the sales app is destroyed: they can still sign in, but the app
-- shows nothing except the destruction screen until an administrator restores
-- them from the desktop.
--
-- This is a row rather than a flag on `users` on purpose:
--   * it records WHICH challenge did it and when, so the decision is auditable;
--   * clearing it is an update, not a delete, so the history of a lockout
--     survives being lifted;
--   * it can never accidentally disable a login for the rest of the platform.
CREATE TABLE IF NOT EXISTS sales_lockouts (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  user_id      INT UNSIGNED NOT NULL,
  challenge_id INT UNSIGNED DEFAULT NULL,
  reason       VARCHAR(255) NOT NULL DEFAULT '',
  locked_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cleared_at   DATETIME     DEFAULT NULL,
  cleared_by   INT UNSIGNED DEFAULT NULL,
  INDEX idx_sl_tenant (tenant_id),
  -- The lookup on every request: is this user locked right now?
  INDEX idx_sl_active (tenant_id, user_id, cleared_at),
  INDEX idx_sl_challenge (tenant_id, challenge_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
