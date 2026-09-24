CREATE TABLE IF NOT EXISTS `document_sequences` (
  `doc_type` varchar(20) NOT NULL,
  `period` varchar(7) NOT NULL,
  `next_value` int(11) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`doc_type`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `settings` (`setting_key`, `setting_value`, `description`) VALUES
  ('pr_prefix', 'PR', 'Purchase request document prefix'),
  ('pr_padding', '4', 'Purchase request document number padding'),
  ('pr_period_policy', 'yearly', 'Purchase request numbering reset policy'),
  ('po_prefix', 'PO', 'Purchase order document prefix'),
  ('po_padding', '4', 'Purchase order document number padding'),
  ('po_period_policy', 'yearly', 'Purchase order numbering reset policy'),
  ('grn_prefix', 'GRN', 'Goods receipt document prefix'),
  ('grn_padding', '4', 'Goods receipt document number padding'),
  ('grn_period_policy', 'yearly', 'Goods receipt numbering reset policy'),
  ('quotation_prefix', 'QTN', 'Quotation document prefix'),
  ('quotation_padding', '4', 'Quotation document number padding'),
  ('quotation_period_policy', 'yearly', 'Quotation numbering reset policy'),
  ('proforma_prefix', 'PFI', 'Proforma invoice document prefix'),
  ('proforma_padding', '4', 'Proforma invoice document number padding'),
  ('proforma_period_policy', 'yearly', 'Proforma invoice numbering reset policy'),
  ('payment_prefix', 'PAY', 'Payment and receipt document prefix'),
  ('payment_padding', '4', 'Payment and receipt document number padding'),
  ('payment_period_policy', 'yearly', 'Payment and receipt numbering reset policy'),
  ('certificate_prefix', 'CERT', 'Test certificate document prefix'),
  ('certificate_padding', '4', 'Test certificate document number padding'),
  ('certificate_period_policy', 'yearly', 'Test certificate numbering reset policy'),
  ('adjustment_prefix', 'ADJ', 'Stock adjustment document prefix'),
  ('adjustment_padding', '4', 'Stock adjustment document number padding'),
  ('adjustment_period_policy', 'yearly', 'Stock adjustment numbering reset policy'),
  ('budget_prefix', 'BUD', 'Budget document prefix'),
  ('budget_padding', '4', 'Budget document number padding'),
  ('budget_period_policy', 'financial_year', 'Budget numbering reset policy'),
  ('invoice_padding', '4', 'Invoice document number padding'),
  ('invoice_period_policy', 'yearly', 'Invoice numbering reset policy'),
  ('order_padding', '4', 'Order document number padding'),
  ('order_period_policy', 'yearly', 'Order numbering reset policy')
ON DUPLICATE KEY UPDATE
  `setting_value` = `setting_value`,
  `description` = COALESCE(`description`, VALUES(`description`));
