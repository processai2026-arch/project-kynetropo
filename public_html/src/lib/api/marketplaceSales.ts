import { apiFetch } from "@/lib/api/client";
import type { MarketplaceSalesOrder, SalesSummary } from "@/types/marketplaceSales";

function qs(p?: Record<string, string | number | undefined>) {
  if (!p) return "";
  const clean = Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== "")
  ) as Record<string, string>;
  return Object.keys(clean).length ? "?" + new URLSearchParams(clean).toString() : "";
}

export const marketplaceSalesApi = {
  async summary(period?: string): Promise<SalesSummary> {
    return (await apiFetch<{ data: SalesSummary }>(`/admin/marketplace-sales/summary${qs({ period })}`)).data;
  },
  async byMarketplace(): Promise<Array<{ marketplace: string; revenue: number; orders: number; commission: number }>> {
    return (await apiFetch<{ data: Array<{ marketplace: string; revenue: number; orders: number; commission: number }> }>("/admin/marketplace-sales/by-marketplace")).data;
  },
  async list(params?: Record<string, string | number | undefined>): Promise<{ data: MarketplaceSalesOrder[]; pagination: Record<string, number> }> {
    return apiFetch(`/admin/marketplace-sales${qs(params)}`);
  },
  async get(id: number): Promise<MarketplaceSalesOrder> {
    return (await apiFetch<{ data: MarketplaceSalesOrder }>(`/admin/marketplace-sales/${id}`)).data;
  },
};
