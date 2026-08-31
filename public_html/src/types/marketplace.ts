export interface MarketplaceSettlement {
  settlement_id: number;
  tenant_id: number;
  marketplace: "amazon" | "flipkart" | "meesho";
  external_id: string | null;
  period_start: string;
  period_end: string;
  gross_sales: number;
  returns_refunds: number;
  marketplace_commission: number;
  tds_deducted: number;
  payment_received: number;
  expected_amount: number;
  difference: number;
  status: "pending" | "received" | "disputed";
  settled_at: string | null;
  created_at: string;
}

export interface MarketplaceAnalytics {
  from: string;
  to: string;
  platforms: PlatformAnalytic[];
  total_revenue: number;
  total_commission: number;
  total_returns: number;
}

export interface PlatformAnalytic {
  marketplace: string;
  revenue: number;
  orders: number;
  commission: number;
  commission_pct: number;
  returns: number;
  top_product: string;
}
