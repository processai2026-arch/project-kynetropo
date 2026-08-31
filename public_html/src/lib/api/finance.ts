/**
 * Finance API — live backend.
 * Endpoints:
 *   GET /admin/finance/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   GET /admin/finance/ratios?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   GET /admin/finance/config
 *   PUT /admin/finance/config
 */
import { apiFetch } from "./client";

export interface MonthlyPoint {
  month: string;
  cashIn: number;
  cashOut: number;
  operatingCashSurplus: number;
}

export interface ExpenseSlice {
  category: string;
  amount: number;
}

/**
 * Cash-based financial summary — NOT accounting Profit & Loss.
 * Derived from paid orders/invoices (cash in) minus recorded expenses (cash
 * out). There is no ledger, no accrual accounting, and no tax computation
 * behind these figures.
 */
export interface PnLSummary {
  periodFrom: string;
  periodTo: string;
  label: string;
  cashIn: number;
  cashOut: number;
  operatingCashSurplus: number;
  monthly: MonthlyPoint[];
  expenseBreakdown: ExpenseSlice[];
  revenueBreakdown: { source: string; amount: number }[];
}

export interface FinancialRatios {
  cashSurplusMargin: number;
  expenseRatio: number;
  /** null when the tenant hasn't entered an `investment` config value. */
  roi: number | null;
  /** null when the tenant hasn't entered current assets/liabilities. */
  currentRatio: number | null;
  /** null when the tenant hasn't entered this balance-sheet input. */
  currentAssets: number | null;
  /** null when the tenant hasn't entered this balance-sheet input. */
  currentLiabilities: number | null;
  /** null when the tenant hasn't entered this balance-sheet input. */
  investment: number | null;
}

export interface FinanceConfig {
  [key: string]: { value: number; notes: string | null };
}

interface ApiEnvelope<T> { success: boolean; data: T }

function buildQuery(params?: { from?: string; to?: string }): string {
  if (!params) return "";
  const parts: string[] = [];
  if (params.from) parts.push(`from=${encodeURIComponent(params.from)}`);
  if (params.to)   parts.push(`to=${encodeURIComponent(params.to)}`);
  return parts.length ? "?" + parts.join("&") : "";
}

export interface FinanceAiAnalysis {
  period: { from: string; to: string };
  health_score: number;
  headline: string;
  summary: string;
  drivers: string[];
  risks: string[];
  recommendations: string[];
  outlook: string;
  figures?: Record<string, unknown>;
  generated_at: string;
}

export const financeApi = {
  async aiAnalysis(params?: { from?: string; to?: string }): Promise<FinanceAiAnalysis> {
    const res = await apiFetch<ApiEnvelope<FinanceAiAnalysis>>(
      "/admin/finance/ai-analysis" + buildQuery(params),
      { method: "POST", body: JSON.stringify({}) },
    );
    return res.data;
  },
  async pnl(params?: { from?: string; to?: string }): Promise<PnLSummary> {
    const res = await apiFetch<ApiEnvelope<PnLSummary>>("/admin/finance/pnl" + buildQuery(params));
    return res.data;
  },
  async ratios(params?: { from?: string; to?: string }): Promise<FinancialRatios> {
    const res = await apiFetch<ApiEnvelope<FinancialRatios>>("/admin/finance/ratios" + buildQuery(params));
    return res.data;
  },
  async config(): Promise<FinanceConfig> {
    const res = await apiFetch<ApiEnvelope<FinanceConfig>>("/admin/finance/config");
    return res.data;
  },
  async updateConfig(patch: Partial<Record<"investment" | "current_assets" | "current_liabilities" | "tax_rate" | "opex_tax_portion", number>>): Promise<void> {
    await apiFetch("/admin/finance/config", {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },
};
