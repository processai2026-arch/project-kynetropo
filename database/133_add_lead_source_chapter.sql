-- Lead source chapter: a lead that came through YES (the business network) is
-- asked which chapter it came from, so referrals can be counted per chapter.
-- Blank for every other source.
-- Idempotent: the column is added only when missing.

SET @c_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_leads' AND COLUMN_NAME = 'source_chapter'
);
SET @c_sql = IF(@c_exists = 0,
  'ALTER TABLE `sales_leads` ADD COLUMN `source_chapter` VARCHAR(120) NOT NULL DEFAULT '''' AFTER `source`',
  'SELECT 1');
PREPARE s FROM @c_sql; EXECUTE s; DEALLOCATE PREPARE s;
