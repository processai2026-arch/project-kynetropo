-- Sales tasks, comment mentions, and the follow-up edit trail.
--
-- Three things that belong to one release, so they migrate together:
--
--  1. sales_tasks — "give someone a job and be told when it is done". A task is
--     assigned BY one person TO one person; only the assignee finishes it, and
--     the person who assigned it is the one notified. Cancellation is soft
--     (cancelled_at) and reopening is allowed, because handing work back is a
--     normal correction rather than an exception.
--
--  2. sales_comment_mentions — who was @mentioned in a comment. Kept as rows
--     rather than parsed out of the body at read time: the body is free text a
--     user can edit afterwards, and a notification must not depend on a name
--     still being spelled the same way.
--
--  3. The follow-up edit trail — a follow-up may only be edited by the person
--     it belongs to, and every edit carries a reason the whole team can see.
--     Without the reason a moved follow-up is indistinguishable from a missed
--     one, which is the thing the queue exists to make visible.

CREATE TABLE IF NOT EXISTS sales_tasks (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id        INT UNSIGNED NOT NULL DEFAULT 1,
  task_code        VARCHAR(20)  DEFAULT NULL,
  title            VARCHAR(200) NOT NULL,
  description      TEXT         DEFAULT NULL,
  -- Who has to do it. Required: a task nobody owns is a note, not a task.
  assigned_to      INT UNSIGNED NOT NULL,
  assigned_to_name VARCHAR(200) NOT NULL DEFAULT '',
  -- Who handed it out. This is the person told when it is finished.
  assigned_by      INT UNSIGNED DEFAULT NULL,
  assigned_by_name VARCHAR(200) NOT NULL DEFAULT '',
  lead_id          INT UNSIGNED DEFAULT NULL,
  due_date         DATE         DEFAULT NULL,
  due_time         TIME         DEFAULT NULL,
  priority         VARCHAR(10)  NOT NULL DEFAULT 'normal',  -- low | normal | high | critical
  status           VARCHAR(20)  NOT NULL DEFAULT 'open',    -- open | in_progress | completed | cancelled
  started_at       DATETIME     DEFAULT NULL,
  completed_at     DATETIME     DEFAULT NULL,
  completed_by     INT UNSIGNED DEFAULT NULL,
  completion_notes TEXT         DEFAULT NULL,
  -- The assigner's verdict once it comes back, so "done" and "accepted as done"
  -- are not silently the same thing.
  reviewed_at      DATETIME     DEFAULT NULL,
  reviewed_by      INT UNSIGNED DEFAULT NULL,
  cancelled_at     DATETIME     DEFAULT NULL,
  cancelled_by     INT UNSIGNED DEFAULT NULL,
  created_by       INT UNSIGNED DEFAULT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_st_tenant (tenant_id),
  INDEX idx_st_assignee (tenant_id, assigned_to, status),
  INDEX idx_st_assigner (tenant_id, assigned_by, status),
  INDEX idx_st_due (tenant_id, status, due_date),
  INDEX idx_st_lead (tenant_id, lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The task's own history, mirroring sales_challenge_activity so the team feed
-- can read both streams the same way.
CREATE TABLE IF NOT EXISTS sales_task_activity (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id  INT UNSIGNED NOT NULL DEFAULT 1,
  task_id    INT UNSIGNED NOT NULL,
  action     VARCHAR(40)  NOT NULL,
  notes      TEXT         DEFAULT NULL,
  actor_id   INT UNSIGNED DEFAULT NULL,
  actor_name VARCHAR(200) NOT NULL DEFAULT '',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sta_task (tenant_id, task_id, id),
  INDEX idx_sta_recent (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_comment_mentions (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id  INT UNSIGNED NOT NULL DEFAULT 1,
  comment_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  user_name  VARCHAR(200) NOT NULL DEFAULT '',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_scm (comment_id, user_id),
  INDEX idx_scm_user (tenant_id, user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
