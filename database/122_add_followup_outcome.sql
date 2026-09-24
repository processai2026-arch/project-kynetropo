-- sales_followups.outcome — what a completed follow-up actually learned.
--
-- SalesFollowup::complete() writes this column and format() reads it, but no
-- schema file ever created it: it went onto the live database by hand when
-- outcomes were added, so a fresh import had the code and not the column, and
-- completing a follow-up failed on a table that looked fine.
--
-- Empty means "completed before outcomes existed", which is what every
-- historical row says and is different from any of the answers a person can
-- now give — so it is a DEFAULT '' rather than a NULL.
--
-- Idempotent: safe to re-run, and registered in migrate.php.

SET @followup_outcome_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sales_followups'
    AND COLUMN_NAME = 'outcome'
);

SET @followup_outcome_sql = IF(
  @followup_outcome_exists = 0,
  'ALTER TABLE `sales_followups` ADD COLUMN `outcome` VARCHAR(30) NOT NULL DEFAULT '''' AFTER `status`',
  'SELECT 1'
);

PREPARE followup_outcome_stmt FROM @followup_outcome_sql;
EXECUTE followup_outcome_stmt;
DEALLOCATE PREPARE followup_outcome_stmt;
