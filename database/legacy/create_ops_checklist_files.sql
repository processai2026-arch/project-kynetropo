-- ─── Document Checklist File Versions ────────────────────────────────────────
-- Adds multi-version file uploads to checklist items.
-- The existing ops_document_checklist.file_path column remains for backwards
-- compatibility but is superseded by this table for new uploads.

CREATE TABLE IF NOT EXISTS ops_document_checklist_files (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT UNSIGNED NOT NULL DEFAULT 1,
  checklist_id  INT UNSIGNED NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  file_name     VARCHAR(255) NOT NULL DEFAULT '',
  version_no    INT UNSIGNED NOT NULL DEFAULT 1,
  uploaded_by   VARCHAR(100) NOT NULL DEFAULT '',
  uploaded_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_checklist (tenant_id, checklist_id),
  FOREIGN KEY (checklist_id) REFERENCES ops_document_checklist(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
