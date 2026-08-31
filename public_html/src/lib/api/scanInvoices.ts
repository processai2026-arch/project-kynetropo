import { apiFetch } from "@/lib/api/client";
import type { ScanInvoice, InvoiceStatusResponse, ExtractedInvoiceData } from "@/types/scanInvoice";

function qs(p?: Record<string, string | number | undefined>) {
  if (!p) return "";
  const clean = Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== "")
  ) as Record<string, string>;
  return Object.keys(clean).length ? "?" + new URLSearchParams(clean).toString() : "";
}

export const scanInvoicesApi = {
  async upload(file: File, marketplace: string): Promise<ScanInvoice> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("marketplace", marketplace);
    return (await apiFetch<{ data: ScanInvoice }>("/admin/scan-invoices/upload", {
      method: "POST",
      body: fd,
    })).data;
  },

  async storeManual(body: Partial<ScanInvoice>): Promise<ScanInvoice> {
    return (await apiFetch<{ data: ScanInvoice }>("/admin/scan-invoices/manual", {
      method: "POST",
      body: JSON.stringify(body),
    })).data;
  },

  async getStatus(id: number): Promise<InvoiceStatusResponse> {
    return (await apiFetch<{ data: InvoiceStatusResponse }>(`/admin/scan-invoices/${id}/status`, {
      skipCache: true,
    })).data;
  },

  async approve(id: number, validatedData: ExtractedInvoiceData): Promise<ScanInvoice> {
    return (await apiFetch<{ data: ScanInvoice }>(`/admin/scan-invoices/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify({ validated_data: validatedData }),
    })).data;
  },

  downloadUrl(id: number): string {
    const raw = localStorage.getItem("erp_admin_auth");
    const token = raw ? (JSON.parse(raw).token ?? "") : "";
    return `${import.meta.env.VITE_API_BASE_URL}/admin/scan-invoices/${id}/download?token=${token}`;
  },

  async list(params?: Record<string, string | number | undefined>): Promise<{ data: ScanInvoice[]; pagination: Record<string, number> }> {
    return apiFetch(`/admin/scan-invoices${qs(params)}`);
  },

  async get(id: number): Promise<ScanInvoice> {
    return (await apiFetch<{ data: ScanInvoice }>(`/admin/scan-invoices/${id}`)).data;
  },

  async update(id: number, body: Partial<ScanInvoice>): Promise<ScanInvoice> {
    return (await apiFetch<{ data: ScanInvoice }>(`/admin/scan-invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })).data;
  },

  async remove(id: number): Promise<void> {
    await apiFetch<void>(`/admin/scan-invoices/${id}`, { method: "DELETE" });
  },
};
