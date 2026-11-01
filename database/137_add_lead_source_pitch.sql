-- Leads from a pitch event.
--
-- sales_leads.source_pitch_id: the pitch event (ops_pitches) a lead came from,
--   picked in the lead's Source. Customers already carry the same link
--   (ops_clients.source_pitch_id), and the two are kept in step, so an event's
--   page counts every lead it brought, their quotes, the deals won and the
--   revenue, and works out the ROI against what the event cost.
-- Existing leads: a converted lead takes its customer's event; every other
--   lead has none until someone picks it.
-- Idempotent: the column and index are added only when missing.

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_leads' AND COLUMN_NAME = 'source_pitch_id'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `sales_leads`
     ADD COLUMN `source_pitch_id` INT UNSIGNED NULL AFTER `source_chapter`,
     ADD INDEX `idx_sl_pitch` (`tenant_id`, `source_pitch_id`)',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE `sales_leads` l
  JOIN `ops_clients` c ON c.id = l.converted_client_id AND c.tenant_id = l.tenant_id
   SET l.source_pitch_id = c.source_pitch_id
 WHERE l.source_pitch_id IS NULL AND c.source_pitch_id IS NOT NULL;
