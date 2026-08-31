import { apiFetch } from "./client";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type JournalStatus = "draft" | "posted";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface LedgerAccount {
  account_id: number;
  code: string;
  name: string;
  type: AccountType;
  description: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface JournalLine {
  journal_line_id: number;
  journal_entry_id: number;
  account_id: number;
  account_code: string | null;
  account_name: string | null;
  account_type: AccountType | null;
  description: string | null;
  debit: number;
  credit: number;
  sort_order: number;
}

export interface JournalEntry {
  journal_entry_id: number;
  entry_number: string;
  entry_date: string;
  reference: string | null;
  description: string;
  status: JournalStatus;
  total_debit: number;
  total_credit: number;
  line_count: number;
  posted_at: string | null;
  created_at: string | null;
  lines?: JournalLine[];
}

export interface AccountPayload {
  code: string;
  name: string;
  type: AccountType;
  description?: string;
  is_active?: boolean;
}

export interface JournalPayload {
  entry_date: string;
  reference?: string;
  description: string;
  post?: boolean;
  lines: Array<{
    account_id: number;
    description?: string;
    debit: number;
    credit: number;
  }>;
}

export interface TrialBalance {
  as_of: string;
  accounts: Array<{
    account_id: number;
    code: string;
    name: string;
    type: AccountType;
    total_debit: number;
    total_credit: number;
    closing_debit: number;
    closing_credit: number;
  }>;
  total_debit: number;
  total_credit: number;
  balanced: boolean;
}

export interface ProfitLoss {
  from: string;
  to: string;
  income: ReportAccount[];
  expenses: ReportAccount[];
  total_income: number;
  total_expenses: number;
  net_profit: number;
}

export interface ReportAccount {
  account_id: number;
  code: string;
  name: string;
  amount: number;
}

export interface BalanceSheet {
  as_of: string;
  assets: ReportAccount[];
  liabilities: ReportAccount[];
  equity: ReportAccount[];
  retained_earnings: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_liabilities_and_equity: number;
  balanced: boolean;
}

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const value = search.toString();
  return value ? `?${value}` : "";
};

export const accountingApi = {
  async accounts(includeInactive = true): Promise<LedgerAccount[]> {
    const response = await apiFetch<ApiEnvelope<LedgerAccount[]>>(
      `/admin/accounting/accounts?include_inactive=${includeInactive ? "true" : "false"}`,
    );
    return response.data;
  },

  async createAccount(payload: AccountPayload): Promise<LedgerAccount> {
    const response = await apiFetch<ApiEnvelope<LedgerAccount>>("/admin/accounting/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async updateAccount(id: number, payload: Partial<AccountPayload>): Promise<LedgerAccount> {
    const response = await apiFetch<ApiEnvelope<LedgerAccount>>(`/admin/accounting/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async deleteAccount(id: number): Promise<void> {
    await apiFetch(`/admin/accounting/accounts/${id}`, { method: "DELETE" });
  },

  async journals(filters?: { status?: JournalStatus; from?: string; to?: string }): Promise<JournalEntry[]> {
    const response = await apiFetch<ApiEnvelope<JournalEntry[]>>(
      `/admin/accounting/journals${query(filters ?? {})}`,
    );
    return response.data;
  },

  async journal(id: number): Promise<JournalEntry> {
    const response = await apiFetch<ApiEnvelope<JournalEntry>>(`/admin/accounting/journals/${id}`);
    return response.data;
  },

  async createJournal(payload: JournalPayload): Promise<JournalEntry> {
    const response = await apiFetch<ApiEnvelope<JournalEntry>>("/admin/accounting/journals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async postJournal(id: number): Promise<JournalEntry> {
    const response = await apiFetch<ApiEnvelope<JournalEntry>>(
      `/admin/accounting/journals/${id}/post`,
      { method: "POST", body: JSON.stringify({}) },
    );
    return response.data;
  },

  async trialBalance(asOf: string): Promise<TrialBalance> {
    const response = await apiFetch<ApiEnvelope<TrialBalance>>(
      `/admin/accounting/reports/trial-balance${query({ as_of: asOf })}`,
    );
    return response.data;
  },

  async profitLoss(from: string, to: string): Promise<ProfitLoss> {
    const response = await apiFetch<ApiEnvelope<ProfitLoss>>(
      `/admin/accounting/reports/profit-loss${query({ from, to })}`,
    );
    return response.data;
  },

  async balanceSheet(asOf: string): Promise<BalanceSheet> {
    const response = await apiFetch<ApiEnvelope<BalanceSheet>>(
      `/admin/accounting/reports/balance-sheet${query({ as_of: asOf })}`,
    );
    return response.data;
  },
};
