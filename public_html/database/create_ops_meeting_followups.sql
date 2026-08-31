-- ─── Meeting Follow-ups ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ops_meeting_followups (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  meeting_id  INT UNSIGNED NOT NULL,
  date        DATE NOT NULL,
  outcome     VARCHAR(500) NOT NULL DEFAULT '',
  notes       TEXT DEFAULT NULL,
  added_by    VARCHAR(100) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_meeting (tenant_id, meeting_id),
  FOREIGN KEY (meeting_id) REFERENCES ops_meetings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
