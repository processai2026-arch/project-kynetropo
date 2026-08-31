import { apiFetch } from "@/lib/api/client";
import type { MarketplaceSettlement, MarketplaceAnalytics } from "@/types/marketplace";

function qs(p?: Record<string, string | number | undefined>) {
  if (!p) return "";
  const clean = Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== "")
  ) as Record<string, string>;
  return Object.keys(clean).length ? "?" + new URLSearchParams(clean).toString() : "";
}

export const marketplaceApi = {
  async analytics(from?: string, to?: string): Promise<MarketplaceAnalytics> {
    return (await apiFetch<{ data: MarketplaceAnalytics }>(`/admin/marketplace-analytics/analytics${qs({ from_date: from, to_date: to })}`)).data;
  },
  async settlements(marketplace?: string): Promise<{ data: MarketplaceSettlement[]; pagination: Record<string, number> }> {
    return apiFetch(`/admin/marketplace-analytics/settlements${qs({ marketplace })}`);
  },
  async storeSettlement(body: Partial<MarketplaceSettlement>): Promise<MarketplaceSettlement> {
    return (await apiFetch<{ data: MarketplaceSettlement }>("/admin/marketplace-analytics/settlements", {
      method: "POST", body: JSON.stringify(body),
    })).data;
  },
  async platformSummary(platform: string): Promise<{ marketplace: string; revenue: number; orders: number; commission: number }> {
    return (await apiFetch<{ data: { marketplace: string; revenue: number; orders: number; commission: number } }>(`/admin/marketplace-analytics/${platform}/summary`)).data;
  },
};
