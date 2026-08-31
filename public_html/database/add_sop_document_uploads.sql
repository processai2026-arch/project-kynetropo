-- V7 fix: original migration targeted sop_versions (wrong table name).
-- V8 fix: ops_sop_files is the canonical SOP file store (see create_ops_sop_files.sql).
--         ops_sop_versions stores text history only — no file columns needed.
--         This migration is intentionally a no-op so migrate.php re-runs are safe.
SELECT 1;
