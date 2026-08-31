export interface ScanInvoice {
  invoice_id: number;
  tenant_id: number;
  file_path: string;
  file_type: "pdf" | "jpg" | "png";
  original_filename: string;
  invoice_number: string | null;
  invoice_date: string | null;
  marketplace: "amazon" | "flipkart" | "meesho" | "other";
  vendor_name: string | null;
  vendor_gstin: string | null;
  customer_id: number | null;
  customer_name?: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  processing_status: "pending" | "processing" | "review" | "approved" | "rejected" | "error";
  ai_confidence_score: number | null;
  extracted_data?: ExtractedInvoiceData | null;
  validated_data?: ExtractedInvoiceData | null;
  error_message: string | null;
  processed_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string | null;
  line_items?: InvoiceLineItem[];
}

export interface ExtractedInvoiceData {
  invoice_number?: string | null;
  invoice_date?: string | null;
  vendor_name?: string | null;
  vendor_gstin?: string | null;
  customer_name?: string | null;
  customer_gstin?: string | null;
  customer_address?: string | null;
  shipping_charges?: number;
  commission_amount?: number;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  line_items?: InvoiceLineItem[];
  field_confidence?: Record<string, number>;
  ai_confidence_score?: number;
}

export interface InvoiceLineItem {
  line_item_id?: number;
  invoice_id?: number;
  product_id?: number | null;
  sku?: string | null;
  product_name: string;
  hsn_code?: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  taxable_value: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_amount: number;
  confidence_score?: number | null;
}

export interface InvoiceStatusResponse {
  invoice_id: number;
  status: ScanInvoice["processing_status"];
  stage: string;
  progress: number;
  ai_confidence_score: number | null;
}
