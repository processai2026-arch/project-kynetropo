-- ─── Ops Process Steps ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ops_process_steps (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  title       VARCHAR(300) NOT NULL,
  datetime    DATETIME DEFAULT NULL,
  status      ENUM('not_started','in_progress','done') NOT NULL DEFAULT 'not_started',
  position    INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ops_process_substeps (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id         INT UNSIGNED NOT NULL DEFAULT 1,
  step_id           INT UNSIGNED NOT NULL,
  parent_substep_id INT UNSIGNED DEFAULT NULL,
  title             VARCHAR(300) NOT NULL,
  datetime          DATETIME DEFAULT NULL,
  status            ENUM('not_started','in_progress','done') NOT NULL DEFAULT 'not_started',
  position          INT UNSIGNED NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_step (tenant_id, step_id),
  FOREIGN KEY (step_id) REFERENCES ops_process_steps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pre-seed 10 development process steps
INSERT INTO ops_process_steps (tenant_id, title, position, status) VALUES
(1, 'Requirements Gathering',    1,  'not_started'),
(1, 'Scope & Estimation',        2,  'not_started'),
(1, 'Design & Wireframes',       3,  'not_started'),
(1, 'Development — Frontend',    4,  'not_started'),
(1, 'Development — Backend',     5,  'not_started'),
(1, 'Internal Code Review',      6,  'not_started'),
(1, 'Internal QA Testing',       7,  'not_started'),
(1, 'Client UAT',                8,  'not_started'),
(1, 'Bug Fixing & Polish',       9,  'not_started'),
(1, 'Delivery & Handover',       10, 'not_started');
