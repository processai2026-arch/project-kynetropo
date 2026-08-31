import { apiFetch } from "@/lib/api/client";
import type { ProductMapping, ProductMappingCheckResult } from "@/types/productMapping";

export const productMappingsApi = {
  async check(productNames: string[]): Promise<ProductMappingCheckResult> {
    return (await apiFetch<{ data: ProductMappingCheckResult }>("/admin/product-mappings/check", {
      method: "POST",
      body: JSON.stringify({ product_names: productNames }),
    })).data;
  },

  async list(): Promise<ProductMapping[]> {
    return (await apiFetch<{ data: ProductMapping[] }>("/admin/product-mappings")).data;
  },

  async get(id: number): Promise<ProductMapping> {
    return (await apiFetch<{ data: ProductMapping }>(`/admin/product-mappings/${id}`)).data;
  },

  async create(data: { invoice_product_name: string; items: Array<{ product_id: number; quantity: number }> }): Promise<ProductMapping> {
    return (await apiFetch<{ data: ProductMapping }>("/admin/product-mappings", {
      method: "POST",
      body: JSON.stringify(data),
    })).data;
  },

  async update(id: number, items: Array<{ product_id: number; quantity: number }>): Promise<ProductMapping> {
    return (await apiFetch<{ data: ProductMapping }>(`/admin/product-mappings/${id}`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    })).data;
  },

  async remove(id: number): Promise<void> {
    await apiFetch<void>(`/admin/product-mappings/${id}`, { method: "DELETE" });
  },
};
