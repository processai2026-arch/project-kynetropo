import { apiFetch } from "@/lib/api/client";

type Envelope<T> = { success?: boolean; message?: string; data: T };

export type QuotationComponent = {
  group?: string;
  name: string;
  make?: string;
  qty?: number;
};

export type QuotationItem = {
  item_id?: number;
  name: string;
  make?: string;
  qty: number;
  unit?: string;
  rate: number;
  amount: number;
  components: QuotationComponent[];
};

export type QuotationStatus = "Draft" | "Sent" | "Accepted" | "Rejected";

export type QuotationListRow = {
  quotation_id: number;
  quotation_no: string;
  customer_name: string;
  particular: string | null;
  quotation_date: string | null;
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  grand_total: number;
  status: QuotationStatus;
  created_at: string;
};

export type Quotation = QuotationListRow & {
  customer_address: string | null;
  terms: string | null;
  notes: string | null;
  items: QuotationItem[];
};

export type QuotationInput = {
  customer_name: string;
  customer_address?: string;
  particular?: string;
  quotation_date?: string;
  gst_rate?: number;
  terms?: string;
  notes?: string;
  status?: QuotationStatus;
  items: QuotationItem[];
};

export async function listQuotations(): Promise<QuotationListRow[]> {
  const res = await apiFetch<Envelope<QuotationListRow[]>>("/admin/quotations");
  return res.data ?? [];
}

export async function getQuotation(id: number): Promise<Quotation> {
  const res = await apiFetch<Envelope<Quotation>>(`/admin/quotations/${id}`);
  return res.data;
}

export async function createQuotation(payload: QuotationInput): Promise<Quotation> {
  const res = await apiFetch<Envelope<Quotation>>("/admin/quotations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateQuotation(id: number, payload: QuotationInput): Promise<Quotation> {
  const res = await apiFetch<Envelope<Quotation>>(`/admin/quotations/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteQuotation(id: number): Promise<void> {
  await apiFetch(`/admin/quotations/${id}`, { method: "DELETE" });
}
