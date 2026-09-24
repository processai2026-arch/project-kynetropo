-- Sales comments — a discussion thread on any sales record.
--
-- A call, follow-up, meeting, challenge or the lead itself can be commented on,
-- so the team can talk about the work where the work is, rather than in a
-- separate chat with no link back to the record.
--
-- Comments are soft-deleted (deleted_at) for the same reason the lead timeline
-- is never purged: an admin reviewing what happened on a deal should not find
-- half the conversation missing.

CREATE TABLE IF NOT EXISTS sales_comments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  entity_type  VARCHAR(20)  NOT NULL,               -- lead | call | followup | meeting | challenge
  entity_id    INT UNSIGNED NOT NULL,
  lead_id      INT UNSIGNED DEFAULT NULL,           -- denormalised: lead-scoped access + feeds
  challenge_id INT UNSIGNED DEFAULT NULL,
  body         TEXT         NOT NULL,
  author_id    INT UNSIGNED DEFAULT NULL,
  author_name  VARCHAR(200) NOT NULL DEFAULT '',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_at    DATETIME     DEFAULT NULL,
  deleted_at   DATETIME     DEFAULT NULL,
  deleted_by   INT UNSIGNED DEFAULT NULL,
  INDEX idx_sc_tenant (tenant_id),
  INDEX idx_sc_entity (tenant_id, entity_type, entity_id, id),
  INDEX idx_sc_lead (tenant_id, lead_id, id),
  INDEX idx_sc_challenge (tenant_id, challenge_id, id),
  INDEX idx_sc_recent (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
