-- Quotations sent to a lead, round by round.
--
-- After the meeting and before onboarding, a quotation goes out; it is
-- rejected, a revised one is sent again, and so on until one is accepted. Each
-- round is a row: version 1, 2, 3…, what was quoted, when, and the answer
-- (sent = still waiting, rejected with why, accepted).
--
-- Kept on the lead, so the rounds follow it when it becomes a customer: the
-- client's page reads them through sales_leads.converted_client_id.
-- Idempotent (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS sales_quotations (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  lead_id      INT UNSIGNED NOT NULL,
  version      SMALLINT UNSIGNED NOT NULL,
  amount       DECIMAL(12,2) NULL,
  sent_on      DATE NOT NULL,
  notes        VARCHAR(500) NOT NULL DEFAULT '',
  status       VARCHAR(12) NOT NULL DEFAULT 'sent',
  answered_on  DATE NULL,
  answer_note  VARCHAR(500) NOT NULL DEFAULT '',
  created_by   INT UNSIGNED NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sq_lead_version (tenant_id, lead_id, version),
  INDEX idx_sq_lead (tenant_id, lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
