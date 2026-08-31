CREATE TABLE IF NOT EXISTS ops_document_templates (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  type        ENUM('pricing_proposal','service_agreement','invoice','welcome_letter','receipt_advance','receipt_final') NOT NULL,
  name        VARCHAR(200) NOT NULL,
  body        LONGTEXT NOT NULL,
  is_default  TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_type (tenant_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
