export interface InvoiceProduct {
  product_id: number;
  tenant_id: number;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  hsn_code: string | null;
  input_gst_rate: number;
  input_gst_amount: number;
  unit: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  damaged_stock: number;
  min_stock_level: number;
  max_stock_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}
