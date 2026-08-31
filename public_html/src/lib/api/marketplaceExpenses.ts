import { apiFetch } from "@/lib/api/client";
import type { MarketplaceExpense, ExpenseSummary } from "@/types/marketplaceExpense";

function qs(p?: Record<string, string | number | undefined>) {
  if (!p) return "";
  const clean = Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== "")
  ) as Record<string, string>;
  return Object.keys(clean).length ? "?" + new URLSearchParams(clean).toString() : "";
}

export const marketplaceExpensesApi = {
  async summary(from?: string, to?: string): Promise<ExpenseSummary> {
    return (await apiFetch<{ data: ExpenseSummary }>(`/admin/marketplace-expenses/summary${qs({ from_date: from, to_date: to })}`)).data;
  },
  async list(params?: Record<string, string | undefined>): Promise<{ data: MarketplaceExpense[]; pagination: Record<string, number> }> {
    return apiFetch(`/admin/marketplace-expenses${qs({ limit: "500", ...params })}`);
  },
  async create(body: Partial<MarketplaceExpense>): Promise<MarketplaceExpense> {
    return (await apiFetch<{ data: MarketplaceExpense }>("/admin/marketplace-expenses", {
      method: "POST", body: JSON.stringify(body),
    })).data;
  },
  async update(id: number, body: Partial<MarketplaceExpense>): Promise<MarketplaceExpense> {
    return (await apiFetch<{ data: MarketplaceExpense }>(`/admin/marketplace-expenses/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    })).data;
  },
  async remove(id: number): Promise<void> {
    await apiFetch<void>(`/admin/marketplace-expenses/${id}`, { method: "DELETE" });
  },
};
