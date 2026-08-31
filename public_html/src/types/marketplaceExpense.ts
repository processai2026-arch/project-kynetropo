export interface MarketplaceExpense {
  expense_id: number;
  tenant_id: number;
  invoice_id: number | null;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  marketplace: "amazon" | "flipkart" | "meesho" | "other" | "none";
  created_at: string;
  updated_at: string | null;
}

export interface ExpenseSummary {
  total: number;
  by_category: Record<string, number>;
  from: string;
  to: string;
}
