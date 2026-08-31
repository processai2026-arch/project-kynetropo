import { apiFetch } from "./client";

export interface VendorCredit {
  credit_id: number;
  vendor_id: number;
  vendor_name?: string;
  vendor_bill_id: number | null;
  bill_number?: string | null;
  credit_number: string;
  credit_date: string;
  reason: string | null;
  amount: number;
  status: "draft" | "applied" | "void";
  notes?: string | null;
}

export interface VendorLite { vendor_id: number; name: string; vendor_code?: string; }

export const vendorCreditsApi = {
  async list(status?: string): Promise<{ data: VendorCredit[]; pagination: { total: number; total_pages: number; page: number } }> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiFetch(`/admin/vendor-credits${q}`);
  },
  async create(body: { vendor_id: number; amount: number; credit_date?: string; reason?: string; vendor_bill_id?: number | null; credit_number?: string; notes?: string }): Promise<VendorCredit> {
    const res = await apiFetch<{ data: VendorCredit }>("/admin/vendor-credits", { method: "POST", body: JSON.stringify(body) });
    return res.data;
  },
  async setStatus(id: number, status: "applied" | "void"): Promise<VendorCredit> {
    const res = await apiFetch<{ data: VendorCredit }>(`/admin/vendor-credits/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
    return res.data;
  },
  async vendors(): Promise<VendorLite[]> {
    const res = await apiFetch<{ data: VendorLite[] }>("/admin/vendors?limit=200");
    return res.data ?? [];
  },
};
