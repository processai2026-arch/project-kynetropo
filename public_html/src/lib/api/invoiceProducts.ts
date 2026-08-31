import { apiFetch } from "@/lib/api/client";
import type { InvoiceProduct } from "@/types/invoiceProduct";

function qs(p?: Record<string, string | number | undefined>) {
  if (!p) return "";
  const clean = Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== "")
  ) as Record<string, string>;
  return Object.keys(clean).length ? "?" + new URLSearchParams(clean).toString() : "";
}

export const invoiceProductsApi = {
  async list(params?: Record<string, string | number | undefined>): Promise<{ data: InvoiceProduct[]; pagination: Record<string, number> }> {
    return apiFetch(`/admin/invoice-product-catalog${qs({ limit: "500", ...params })}`);
  },
  async lowStock(): Promise<InvoiceProduct[]> {
    return (await apiFetch<{ data: InvoiceProduct[] }>("/admin/invoice-product-catalog/low-stock")).data;
  },
  async get(id: number): Promise<InvoiceProduct> {
    return (await apiFetch<{ data: InvoiceProduct }>(`/admin/invoice-product-catalog/${id}`)).data;
  },
  async create(body: Partial<InvoiceProduct>): Promise<InvoiceProduct> {
    return (await apiFetch<{ data: InvoiceProduct }>("/admin/invoice-product-catalog", {
      method: "POST", body: JSON.stringify(body),
    })).data;
  },
  async update(id: number, body: Partial<InvoiceProduct>): Promise<InvoiceProduct> {
    return (await apiFetch<{ data: InvoiceProduct }>(`/admin/invoice-product-catalog/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    })).data;
  },
  async remove(id: number): Promise<void> {
    await apiFetch<void>(`/admin/invoice-product-catalog/${id}`, { method: "DELETE" });
  },
};
