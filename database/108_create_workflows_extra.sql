-- Workflows / approvals module completion (see docs/MODULE_GAP_ANALYSIS.md, "Tasks, workflows, and SOPs").
--
-- Adds:
--   1. Actor-identity columns on `workflows`/`workflow_history` that store the real
--      users.user_id alongside the existing EMP-XXX employee_key, so the backend can
--      resolve "who is the authenticated caller" without relying on employee_id ==
--      user_id (they are independent primary keys and were being conflated).
--   2. SLA/due-time + escalation tracking columns on `workflows`.
--   3. Reusable approval DEFINITIONS: a tenant-configurable workflow type with an
--      ordered chain of approval steps, each with an approver role/specific approver,
--      a condition (e.g. amount threshold), required fields, and a per-step SLA.
--      `workflows.definition_id` / `workflows.current_step_id` link a live workflow
--      instance back to the definition + step driving it, so transition validation
--      and escalation can be driven by data instead of hard-coded stage logic.
--
-- Safe to re-run: every ALTER is guarded via information_schema, every CREATE uses
-- IF NOT EXISTS. tenant_id is present on every new table; existing rows are backfilled
-- defensively (tenant_id = 1) only as a column default, never overwriting real data.

SET @schema_name = DATABASE();

-- ── workflows.requester_user_id / approver_user_id — true users.user_id link ────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'requester_user_id') = 0,
  'ALTER TABLE `workflows` ADD COLUMN `requester_user_id` INT NULL AFTER `requester_name`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'approver_user_id') = 0,
  'ALTER TABLE `workflows` ADD COLUMN `approver_user_id` INT NULL AFTER `approver_name`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── workflows.due_at — SLA deadline for the CURRENT stage (datetime, not just a date) ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'due_at') = 0,
  'ALTER TABLE `workflows` ADD COLUMN `due_at` DATETIME NULL AFTER `due_date`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── workflows.escalated_at / reminder tracking — drives the chasing cron ────────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'escalated_at') = 0,
  'ALTER TABLE `workflows` ADD COLUMN `escalated_at` DATETIME NULL AFTER `due_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'last_reminder_at') = 0,
  'ALTER TABLE `workflows` ADD COLUMN `last_reminder_at` DATETIME NULL AFTER `escalated_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'reminder_count') = 0,
  'ALTER TABLE `workflows` ADD COLUMN `reminder_count` INT NOT NULL DEFAULT 0 AFTER `last_reminder_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── workflows.definition_id / current_step_id — link instance to its definition ─
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'definition_id') = 0,
  'ALTER TABLE `workflows` ADD COLUMN `definition_id` INT NULL AFTER `type`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'current_step_id') = 0,
  'ALTER TABLE `workflows` ADD COLUMN `current_step_id` INT NULL AFTER `definition_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── workflow_history.actor_user_id — true users.user_id for the audit trail ─────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflow_history' AND COLUMN_NAME = 'actor_user_id') = 0,
  'ALTER TABLE `workflow_history` ADD COLUMN `actor_user_id` INT NULL AFTER `actor_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── tenant_id backfill guard — workflows/workflow_history predate strict tenancy
--    on some installs; make sure the column exists (no-op if already added by the
--    core tenancy migration) so every query below can rely on it.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND COLUMN_NAME = 'tenant_id') = 0,
  'ALTER TABLE `workflows` ADD COLUMN `tenant_id` INT NOT NULL DEFAULT 1 AFTER `workflow_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflow_history' AND COLUMN_NAME = 'tenant_id') = 0,
  'ALTER TABLE `workflow_history` ADD COLUMN `tenant_id` INT NOT NULL DEFAULT 1 AFTER `history_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── Helpful indexes for the new lookup/escalation columns ───────────────────────
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND INDEX_NAME = 'idx_workflows_due_at') = 0,
  'ALTER TABLE `workflows` ADD INDEX `idx_workflows_due_at` (`tenant_id`, `due_at`, `stage`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'workflows' AND INDEX_NAME = 'idx_workflows_definition') = 0,
  'ALTER TABLE `workflows` ADD INDEX `idx_workflows_definition` (`definition_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reusable approval DEFINITIONS — the business-differentiating, work-reducing
-- feature: instead of every workflow inventing its own approver/threshold logic,
-- a tenant admin configures a definition once (e.g. "Purchase Request > 50,000")
-- and every new workflow of that type follows it automatically, including SLA
-- escalation and reminder emails.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `workflow_definitions` (
  `definition_id`   INT NOT NULL AUTO_INCREMENT,
  `tenant_id`       INT NOT NULL,
  `name`            VARCHAR(150) NOT NULL,
  `type`            VARCHAR(60) NOT NULL COMMENT 'Matches Workflow::TYPES, e.g. Purchase Request',
  `description`     TEXT NULL,
  `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
  -- Condition this definition applies under, e.g. {"min_amount":50000,"max_amount":null}
  `condition_json`  TEXT NULL,
  -- Fields the requester must supply before submission is accepted, e.g. ["amount","due_date"]
  `required_fields_json` TEXT NULL,
  `created_by`      INT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`definition_id`),
  KEY `idx_workflow_definitions_tenant` (`tenant_id`),
  KEY `idx_workflow_definitions_type` (`tenant_id`, `type`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `workflow_definition_steps` (
  `step_id`          INT NOT NULL AUTO_INCREMENT,
  `tenant_id`        INT NOT NULL,
  `definition_id`    INT NOT NULL,
  `step_order`       INT NOT NULL DEFAULT 1,
  `name`             VARCHAR(120) NOT NULL,
  `to_stage`         VARCHAR(30) NOT NULL COMMENT 'Stage this step transitions the workflow into when completed',
  -- Approver authority for this step: a role (matches users.staff_role / 'owner')
  -- and/or a specific employee_key. At least one must be satisfied by the actor.
  `approver_role`    VARCHAR(30) NULL COMMENT 'owner|accountant|store_keeper|hr|sales — matches AdminMiddleware staff roles',
  `approver_employee_key` VARCHAR(20) NULL COMMENT 'Specific required approver (EMP-XXX), optional',
  `sla_hours`        INT NOT NULL DEFAULT 24 COMMENT 'Hours allowed for this step before it is overdue',
  `escalate_to_employee_key` VARCHAR(20) NULL COMMENT 'Who gets escalated to if this step breaches SLA',
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`step_id`),
  KEY `idx_workflow_def_steps_definition` (`definition_id`, `step_order`),
  KEY `idx_workflow_def_steps_tenant` (`tenant_id`),
  CONSTRAINT `fk_workflow_def_steps_definition` FOREIGN KEY (`definition_id`) REFERENCES `workflow_definitions` (`definition_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Escalation/reminder audit trail — one row per email actually sent so the
-- chasing cron is idempotent within its own polling window and tenants can
-- see "we nudged this 3 times" history.
CREATE TABLE IF NOT EXISTS `workflow_escalations` (
  `escalation_id`   INT NOT NULL AUTO_INCREMENT,
  `tenant_id`       INT NOT NULL,
  `workflow_id`     INT NOT NULL,
  `kind`            VARCHAR(20) NOT NULL DEFAULT 'reminder' COMMENT 'reminder|escalation',
  `recipient_email` VARCHAR(180) NULL,
  `sent`            TINYINT(1) NOT NULL DEFAULT 0,
  `note`            VARCHAR(255) NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`escalation_id`),
  KEY `idx_workflow_escalations_workflow` (`workflow_id`),
  KEY `idx_workflow_escalations_tenant` (`tenant_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
