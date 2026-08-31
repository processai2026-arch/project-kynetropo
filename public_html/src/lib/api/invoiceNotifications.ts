import { apiFetch } from "@/lib/api/client";
import type { InvoiceNotification } from "@/types/invoiceNotification";

function qs(p?: Record<string, string | number | undefined>) {
  if (!p) return "";
  const clean = Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== "")
  ) as Record<string, string>;
  return Object.keys(clean).length ? "?" + new URLSearchParams(clean).toString() : "";
}

export const invoiceNotificationsApi = {
  async list(params?: { is_read?: string }): Promise<{ data: InvoiceNotification[]; pagination: Record<string, number> & { unread_count?: number } }> {
    return apiFetch(`/admin/invoice-notifications${qs({ limit: "500", ...params })}`);
  },
  async markRead(id: number): Promise<void> {
    await apiFetch<void>(`/admin/invoice-notifications/${id}/read`, { method: "PUT" });
  },
  async readAll(): Promise<void> {
    await apiFetch<void>("/admin/invoice-notifications/read-all", { method: "PUT" });
  },
  async remove(id: number): Promise<void> {
    await apiFetch<void>(`/admin/invoice-notifications/${id}`, { method: "DELETE" });
  },
};
