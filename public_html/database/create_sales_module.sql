-- ============================================================================
-- Kynetropo Sales Module — leads, calls, follow-ups, meetings, challenges.
--
-- Tenant-scoped like every other module (tenant_id + index). Idempotent
-- (CREATE TABLE IF NOT EXISTS), so it is safe to re-run and is registered in
-- database/migrate.php under the feature schemas list.
--
-- Deliberately does NOT duplicate existing entities:
--   * sales users         -> `users` (user_type = 'admin', staff_role = 'sales')
--   * permissions/roles   -> `roles` / `user_roles` (create_rbac.sql)
--   * converted customers -> `ops_clients` (the existing project/DRP system)
--   * project execution   -> `ops_projects` (untouched by this module)
-- ============================================================================

-- Leads ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_leads (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id            INT UNSIGNED NOT NULL DEFAULT 1,
  lead_code            VARCHAR(20)  NOT NULL DEFAULT '',
  name                 VARCHAR(200) NOT NULL,
  company              VARCHAR(200) NOT NULL DEFAULT '',
  contact_person       VARCHAR(200) NOT NULL DEFAULT '',
  phone                VARCHAR(30)  NOT NULL DEFAULT '',
  email                VARCHAR(200) NOT NULL DEFAULT '',
  source               VARCHAR(60)  NOT NULL DEFAULT '',
  assigned_to          INT UNSIGNED DEFAULT NULL,
  status               ENUM('new','contacted','qualified','meeting_scheduled','proposal','onboarding','converted','lost')
                       NOT NULL DEFAULT 'new',
  temperature          ENUM('hot','warm','cold') NOT NULL DEFAULT 'warm',
  next_followup_at     DATETIME DEFAULT NULL,
  next_meeting_at      DATETIME DEFAULT NULL,
  last_activity_at     DATETIME DEFAULT NULL,
  last_outcome         VARCHAR(40)  NOT NULL DEFAULT '',
  notes                TEXT,
  converted_client_id  INT UNSIGNED DEFAULT NULL,
  converted_project_id INT UNSIGNED DEFAULT NULL,
  converted_at         DATETIME DEFAULT NULL,
  created_by           INT UNSIGNED DEFAULT NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sl_tenant (tenant_id),
  INDEX idx_sl_assigned (tenant_id, assigned_to),
  INDEX idx_sl_temperature (tenant_id, temperature),
  INDEX idx_sl_status (tenant_id, status),
  INDEX idx_sl_followup (tenant_id, next_followup_at),
  INDEX idx_sl_phone (tenant_id, phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Call logs ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_calls (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id         INT UNSIGNED NOT NULL DEFAULT 1,
  lead_id           INT UNSIGNED NOT NULL,
  called_by         INT UNSIGNED DEFAULT NULL,
  called_by_name    VARCHAR(200) NOT NULL DEFAULT '',
  call_date         DATE NOT NULL,
  call_time         TIME DEFAULT NULL,
  duration_minutes  INT UNSIGNED NOT NULL DEFAULT 0,
  outcome           VARCHAR(40) NOT NULL DEFAULT 'follow_up_required',
  notes             TEXT,
  temperature_after ENUM('hot','warm','cold') DEFAULT NULL,
  followup_id       INT UNSIGNED DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sc_tenant (tenant_id),
  INDEX idx_sc_lead (tenant_id, lead_id),
  INDEX idx_sc_date (tenant_id, call_date),
  INDEX idx_sc_caller (tenant_id, called_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Follow-ups -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_followups (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id      INT UNSIGNED NOT NULL DEFAULT 1,
  lead_id        INT UNSIGNED NOT NULL,
  call_id        INT UNSIGNED DEFAULT NULL,
  meeting_id     INT UNSIGNED DEFAULT NULL,
  due_date       DATE NOT NULL,
  due_time       TIME DEFAULT NULL,
  assigned_to    INT UNSIGNED DEFAULT NULL,
  status         ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  purpose        VARCHAR(200) NOT NULL DEFAULT '',
  outcome_notes  TEXT,
  completed_by   INT UNSIGNED DEFAULT NULL,
  completed_at   DATETIME DEFAULT NULL,
  created_by     INT UNSIGNED DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sf_tenant (tenant_id),
  INDEX idx_sf_lead (tenant_id, lead_id),
  INDEX idx_sf_due (tenant_id, status, due_date),
  INDEX idx_sf_assigned (tenant_id, assigned_to, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Meetings -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_meetings (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id         INT UNSIGNED NOT NULL DEFAULT 1,
  lead_id           INT UNSIGNED NOT NULL,
  title             VARCHAR(200) NOT NULL,
  meeting_type      ENUM('physical','virtual') NOT NULL DEFAULT 'virtual',
  meeting_date      DATE NOT NULL,
  meeting_time      TIME DEFAULT NULL,
  place             VARCHAR(255) NOT NULL DEFAULT '',
  meeting_link      VARCHAR(500) NOT NULL DEFAULT '',
  participants      TEXT,
  notes             TEXT,
  status            ENUM('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  outcome           VARCHAR(40) NOT NULL DEFAULT '',
  outcome_notes     TEXT,
  requirements      TEXT,
  decisions         TEXT,
  next_action       TEXT,
  next_meeting_date DATE DEFAULT NULL,
  assigned_to       INT UNSIGNED DEFAULT NULL,
  created_by        INT UNSIGNED DEFAULT NULL,
  completed_at      DATETIME DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sm_tenant (tenant_id),
  INDEX idx_sm_lead (tenant_id, lead_id),
  INDEX idx_sm_date (tenant_id, status, meeting_date),
  INDEX idx_sm_assigned (tenant_id, assigned_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lead activity timeline (audit trail for the sales lifecycle) ---------------
CREATE TABLE IF NOT EXISTS sales_lead_activities (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id      INT UNSIGNED NOT NULL DEFAULT 1,
  lead_id        INT UNSIGNED NOT NULL,
  activity_type  VARCHAR(40)  NOT NULL,
  title          VARCHAR(200) NOT NULL DEFAULT '',
  description    TEXT,
  reference_type VARCHAR(30)  NOT NULL DEFAULT '',
  reference_id   INT UNSIGNED DEFAULT NULL,
  metadata       TEXT,
  actor_id       INT UNSIGNED DEFAULT NULL,
  actor_name     VARCHAR(200) NOT NULL DEFAULT '',
  occurred_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sla_tenant (tenant_id),
  INDEX idx_sla_lead (tenant_id, lead_id, occurred_at),
  INDEX idx_sla_type (tenant_id, activity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Challenges ("Challenge Accepted") ------------------------------------------
CREATE TABLE IF NOT EXISTS sales_challenges (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id        INT UNSIGNED NOT NULL DEFAULT 1,
  challenge_code   VARCHAR(20)  NOT NULL DEFAULT '',
  title            VARCHAR(200) NOT NULL,
  description      TEXT,
  lead_id          INT UNSIGNED DEFAULT NULL,
  client_id        INT UNSIGNED DEFAULT NULL,
  deadline         DATETIME NOT NULL,
  priority         ENUM('low','normal','high','critical') NOT NULL DEFAULT 'normal',
  status           ENUM('available','accepted','in_progress','completed','expired','cancelled')
                   NOT NULL DEFAULT 'available',
  accepted_by      INT UNSIGNED DEFAULT NULL,
  accepted_at      DATETIME DEFAULT NULL,
  started_at       DATETIME DEFAULT NULL,
  completed_by     INT UNSIGNED DEFAULT NULL,
  completed_at     DATETIME DEFAULT NULL,
  completion_notes TEXT,
  expired_at       DATETIME DEFAULT NULL,
  created_by       INT UNSIGNED DEFAULT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sch_tenant (tenant_id),
  INDEX idx_sch_status (tenant_id, status),
  INDEX idx_sch_deadline (tenant_id, deadline),
  INDEX idx_sch_accepted (tenant_id, accepted_by),
  INDEX idx_sch_lead (tenant_id, lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Which sales users a challenge is offered to. No rows = offered to every user
-- holding the sales.challenges.view permission.
CREATE TABLE IF NOT EXISTS sales_challenge_assignments (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  challenge_id INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sca (tenant_id, challenge_id, user_id),
  INDEX idx_sca_user (tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_challenge_activity (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  challenge_id INT UNSIGNED NOT NULL,
  action       VARCHAR(40)  NOT NULL,
  notes        TEXT,
  actor_id     INT UNSIGNED DEFAULT NULL,
  actor_name   VARCHAR(200) NOT NULL DEFAULT '',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_scha_tenant (tenant_id),
  INDEX idx_scha_challenge (tenant_id, challenge_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
