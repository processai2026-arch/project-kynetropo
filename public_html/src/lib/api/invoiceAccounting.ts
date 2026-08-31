import { apiFetch } from "@/lib/api/client";

export interface InvoiceAccountingPL {
  from: string; to: string;
  revenue: number; cogs: number; gross_profit: number;
  shipping_cost: number; commission_cost: number; other_expenses: number;
  operating_profit: number; gst_payable: number; net_profit: number;
}

export interface JournalEntry {
  entry_id: number; tenant_id: number; invoice_id: number | null;
  entry_date: string; entry_number: string; description: string;
  debit_account: string; credit_account: string; amount: number;
  invoice_number?: string | null;
}

export interface ChartAccount {
  code: string; name: string; type: string;
}

function qs(p?: Record<string, string | undefined>) {
  if (!p) return "";
  const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => v)) as Record<string, string>;
  return Object.keys(clean).length ? "?" + new URLSearchParams(clean).toString() : "";
}

export const invoiceAccountingApi = {
  async journalEntries(params?: Record<string, string | undefined>): Promise<{ data: JournalEntry[]; pagination: Record<string, number> }> {
    return apiFetch(`/admin/invoice-accounting/journal-entries${qs(params)}`);
  },
  async profitLoss(from?: string, to?: string): Promise<InvoiceAccountingPL> {
    return (await apiFetch<{ data: InvoiceAccountingPL }>(`/admin/invoice-accounting/profit-loss${qs({ from_date: from, to_date: to })}`)).data;
  },
  async balanceSheet(): Promise<Record<string, unknown>> {
    return (await apiFetch<{ data: Record<string, unknown> }>("/admin/invoice-accounting/balance-sheet")).data;
  },
  async accounts(): Promise<ChartAccount[]> {
    return (await apiFetch<{ data: ChartAccount[] }>("/admin/invoice-accounting/accounts")).data;
  },
};
