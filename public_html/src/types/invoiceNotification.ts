export interface InvoiceNotification {
  notification_id: number;
  tenant_id: number;
  type:
    | "low_stock"
    | "duplicate_invoice"
    | "gst_mismatch"
    | "invoice_error"
    | "ai_low_confidence"
    | "new_sales_record"
    | "inventory_warning"
    | "gst_due";
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
