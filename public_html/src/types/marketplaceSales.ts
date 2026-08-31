export interface MarketplaceSalesOrder {
  order_id: number;
  tenant_id: number;
  invoice_id: number;
  customer_id: number | null;
  customer_name?: string | null;
  customer_gstin?: string | null;
  order_number: string;
  order_date: string;
  marketplace: "amazon" | "flipkart" | "meesho" | "other";
  marketplace_order_id: string | null;
  subtotal: number;
  discount: number;
  tax_amount: number;
  shipping_charges: number;
  commission_amount: number;
  total_amount: number;
  net_revenue: number;
  status: "completed" | "pending" | "cancelled" | "returned";
  created_at: string;
  updated_at: string | null;
  invoice_number?: string | null;
  vendor_name?: string | null;
}

export interface SalesSummary {
  period: string;
  from: string;
  to: string;
  revenue: number;
  orders: number;
  returns: number;
  avg_order_value: number;
  by_marketplace: MarketplaceStat[];
}

export interface MarketplaceStat {
  marketplace: string;
  revenue: number;
  orders: number;
  commission: number;
}
