import { apiFetch } from "@/lib/api/client";
import type { GstSummary, GstRecord, HsnSummaryRow } from "@/types/gst";

export const gstApi = {
  async summary(year?: number): Promise<GstSummary> {
    const q = year ? `?year=${year}` : "";
    return (await apiFetch<{ data: GstSummary }>(`/admin/gst-returns/summary${q}`)).data;
  },
  async monthly(year: number, month: number): Promise<{ records: GstRecord[]; count: number }> {
    return (await apiFetch<{ data: { records: GstRecord[]; count: number } }>(`/admin/gst-returns/monthly/${year}/${month}`)).data;
  },
  async hsnSummary(from?: string, to?: string): Promise<HsnSummaryRow[]> {
    const p = new URLSearchParams();
    if (from) p.set("from_date", from);
    if (to) p.set("to_date", to);
    const q = p.toString() ? "?" + p.toString() : "";
    return (await apiFetch<{ data: HsnSummaryRow[] }>(`/admin/gst-returns/hsn-summary${q}`)).data;
  },
};
