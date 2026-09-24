-- TMS (Traffic Management System) — daily per-employee task completion tracker.
-- Each row = one employee's task for a day, marked done (green) or not done (red).
-- Populated via the "Task Status (TMS)" upload on the Attendance page.
-- Run once in phpMyAdmin.

CREATE TABLE IF NOT EXISTS `tms_tasks` (
  `tms_task_id`   INT AUTO_INCREMENT PRIMARY KEY,
  `employee_key`  VARCHAR(64)  NOT NULL,                -- matches employees.employee_key
  `task_date`     DATE         NOT NULL,
  `task`          VARCHAR(255) NOT NULL DEFAULT '',     -- task name / description
  `completed`     TINYINT(1)   NOT NULL DEFAULT 0,      -- 1 = done, 0 = not done
  `status`        VARCHAR(10)  NOT NULL DEFAULT 'red',  -- 'green' = done, 'red' = not done
  `import_job_id` INT          NULL,                    -- source import job (audit trail)
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NULL,
  UNIQUE KEY `uk_tms_emp_date_task` (`employee_key`, `task_date`, `task`),
  KEY `idx_tms_date` (`task_date`),
  KEY `idx_tms_emp`  (`employee_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
