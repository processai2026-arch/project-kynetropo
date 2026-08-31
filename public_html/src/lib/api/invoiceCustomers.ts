import { apiFetch } from "@/lib/api/client";
import type { InvoiceCustomer } from "@/types/invoiceCustomer";

function qs(p?: Record<string, string | number | undefined>) {
  if (!p) return "";
  const clean = Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== "")
  ) as Record<string, string>;
  return Object.keys(clean).length ? "?" + new URLSearchParams(clean).toString() : "";
}

export const invoiceCustomersApi = {
  async list(params?: Record<string, string | undefined>): Promise<{ data: InvoiceCustomer[]; pagination: Record<string, number> }> {
    return apiFetch(`/admin/invoice-customers${qs({ limit: "500", ...params })}`);
  },
  async get(id: number): Promise<InvoiceCustomer> {
    return (await apiFetch<{ data: InvoiceCustomer }>(`/admin/invoice-customers/${id}`)).data;
  },
  async purchases(id: number): Promise<InvoiceCustomer> {
    return (await apiFetch<{ data: InvoiceCustomer }>(`/admin/invoice-customers/${id}/purchases`)).data;
  },
  async create(body: Partial<InvoiceCustomer>): Promise<InvoiceCustomer> {
    return (await apiFetch<{ data: InvoiceCustomer }>("/admin/invoice-customers", {
      method: "POST", body: JSON.stringify(body),
    })).data;
  },
  async update(id: number, body: Partial<InvoiceCustomer>): Promise<InvoiceCustomer> {
    return (await apiFetch<{ data: InvoiceCustomer }>(`/admin/invoice-customers/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    })).data;
  },
  async remove(id: number): Promise<void> {
    await apiFetch<void>(`/admin/invoice-customers/${id}`, { method: "DELETE" });
  },
};
