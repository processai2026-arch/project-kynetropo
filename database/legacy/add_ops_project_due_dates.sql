-- Add due dates for current work and next action on projects
ALTER TABLE ops_projects
  ADD COLUMN current_work_due DATE DEFAULT NULL AFTER current_work,
  ADD COLUMN next_action_due  DATE DEFAULT NULL AFTER next_action;
