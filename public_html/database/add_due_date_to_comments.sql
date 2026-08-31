-- ─── Due Date on Comment Fields ───────────────────────────────────────────────
-- Adds optional due_date to activity comments and bug comments so a comment
-- can become a Dashboard "Today's Actions" item on a chosen date.

ALTER TABLE ops_activity_log
  ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;

ALTER TABLE ops_activity_comments
  ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;

ALTER TABLE ops_bug_comments
  ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL;
