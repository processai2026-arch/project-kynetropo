export interface InvoiceCustomer {
  customer_id: number;
  tenant_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  customer_type: "b2b" | "b2c";
  total_purchases: number;
  lifetime_revenue: number;
  created_at: string;
  updated_at: string | null;
  purchases?: CustomerPurchase[];
}

export interface CustomerPurchase {
  order_id: number;
  order_number: string;
  order_date: string;
  marketplace: string;
  total_amount: number;
  net_revenue: number;
  status: string;
  invoice_number: string | null;
}
