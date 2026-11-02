-- Other income: money in that is not a client's payment on a project — a
-- hackathon prize, a grant, interest. Counted with project payments and AMC in
-- Income and in Profit & Loss.
-- Idempotent (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS ops_other_income (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  date        DATE NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  source      VARCHAR(150) NOT NULL,
  notes       TEXT NULL,
  added_by    VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_oi_tenant_date (tenant_id, date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
