-- V4 normalization fix: remove legacy file_path column from ops_document_checklist.
-- The ops_document_checklist_files table is the canonical store for checklist
-- file attachments (versioned). The file_path column on the parent row was a
-- transitional column that is now superseded. Any non-null values have already
-- been written to ops_document_checklist_files by checklistUpload().
--
-- Safe to run: column is nullable, no FK references it.

-- Migrate any orphan file_path values not yet in the versioned table
INSERT INTO ops_document_checklist_files (tenant_id, checklist_id, file_path, file_name, version_no, uploaded_by)
SELECT c.tenant_id, c.id, c.file_path,
       SUBSTRING_INDEX(c.file_path, '/', -1) AS file_name,
       1 AS version_no,
       'migrated' AS uploaded_by
FROM ops_document_checklist c
WHERE c.file_path IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM ops_document_checklist_files f
      WHERE f.checklist_id = c.id AND f.file_path = c.file_path
  );

-- Drop the legacy column
ALTER TABLE ops_document_checklist DROP COLUMN file_path;
