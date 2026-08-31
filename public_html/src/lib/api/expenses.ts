/**
 * Expenses API — live backend.
 * Endpoints: /admin/expenses (GET, POST), /admin/expenses/{id} (GET, PUT, DELETE),
 *            /admin/expenses/categories (GET), /admin/expenses/claims/*
 */
import { apiFetch } from "./client";

export const EXPENSE_CATEGORIES = [
  "Office Stationery",
  "Employee Welfare",
  "Salary",
  "Maintenance Spares",
  "Rent",
  "Raw Materials - Wood Powder",
  "Raw Materials - Nappier Grass",
  "Raw Materials - Wood Bark",
  "Raw Materials - Cotton Stalk",
  "Raw Materials - Corn Cob",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number] | string;

export interface Expense {
  id: string;
  date: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  paymentMode: "Cash" | "Bank Transfer" | "UPI" | "Cheque" | "Card";
  billUrl?: string;
  createdBy: string;
}

interface ApiExpense {
  expense_id: number;
  expense_code: string;
  expense_date: string;
  category: string;
  vendor: string;
  description: string | null;
  amount: number;
  payment_mode: Expense["paymentMode"];
  bill_url: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination?: { page: number; limit: number; total: number; total_pages: number };
}

export type ExpenseClaimStatus = "pending" | "approved" | "rejected" | "reimbursed";

export interface ExpenseClaimItem {
  itemId: number;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  receiptUrl?: string;
  policyLimit: number;
  policyWarning: boolean;
}

export interface ExpenseClaim {
  claimId: number;
  claimNumber: string;
  employeeKey: string;
  employeeName: string;
  purpose: string;
  totalAmount: number;
  status: ExpenseClaimStatus;
  hasPolicyWarnings: boolean;
  submittedAt: string;
  approvedAt?: string;
  approvedByName?: string;
  approvalNote?: string;
  rejectedAt?: string;
  rejectedByName?: string;
  rejectionReason?: string;
  reimbursedAt?: string;
  reimbursedByName?: string;
  reimbursementDate?: string;
  reimbursementReference?: string;
  items: ExpenseClaimItem[];
}

export interface ExpenseClaimLineInput {
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  receiptUrl?: string;
}

export interface ExpenseClaimInput {
  employeeKey: string;
  purpose: string;
  items: ExpenseClaimLineInput[];
}

export interface ExpenseClaimPolicies {
  categoryLimits: Record<string, number>;
  defaultLimit: number;
  mode: "warning";
}

interface ApiExpenseClaimItem {
  item_id: number;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  receipt_url: string | null;
  policy_limit: number;
  policy_warning: boolean | number;
}

interface ApiExpenseClaim {
  claim_id: number;
  claim_number: string;
  employee_key: string;
  employee_name: string | null;
  purpose: string;
  total_amount: number;
  status: ExpenseClaimStatus;
  has_policy_warnings: boolean | number;
  submitted_at: string;
  approved_at: string | null;
  approved_by_name: string | null;
  approval_note: string | null;
  rejected_at: string | null;
  rejected_by_name: string | null;
  rejection_reason: string | null;
  reimbursed_at: string | null;
  reimbursed_by_name: string | null;
  reimbursement_date: string | null;
  reimbursement_reference: string | null;
  items?: ApiExpenseClaimItem[];
}

function toUI(row: ApiExpense): Expense {
  return {
    id: row.expense_code,
    date: (row.expense_date || "").slice(0, 10),
    category: row.category,
    vendor: row.vendor,
    description: row.description ?? "",
    amount: Number(row.amount) || 0,
    paymentMode: row.payment_mode,
    billUrl: row.bill_url ?? undefined,
    createdBy: row.created_by ? String(row.created_by) : "admin",
  };
}

function toApi(input: Partial<Omit<Expense, "id" | "createdBy">>) {
  return {
    expense_date: input.date,
    category: input.category,
    vendor: input.vendor,
    description: input.description,
    amount: input.amount,
    payment_mode: input.paymentMode,
    bill_url: input.billUrl,
  };
}

function toClaim(row: ApiExpenseClaim): ExpenseClaim {
  return {
    claimId: Number(row.claim_id),
    claimNumber: row.claim_number,
    employeeKey: row.employee_key,
    employeeName: row.employee_name ?? row.employee_key,
    purpose: row.purpose,
    totalAmount: Number(row.total_amount) || 0,
    status: row.status,
    hasPolicyWarnings: Boolean(Number(row.has_policy_warnings)),
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at ?? undefined,
    approvedByName: row.approved_by_name ?? undefined,
    approvalNote: row.approval_note ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
    rejectedByName: row.rejected_by_name ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    reimbursedAt: row.reimbursed_at ?? undefined,
    reimbursedByName: row.reimbursed_by_name ?? undefined,
    reimbursementDate: row.reimbursement_date ?? undefined,
    reimbursementReference: row.reimbursement_reference ?? undefined,
    items: (row.items ?? []).map((item) => ({
      itemId: Number(item.item_id),
      expenseDate: (item.expense_date || "").slice(0, 10),
      category: item.category,
      description: item.description,
      amount: Number(item.amount) || 0,
      receiptUrl: item.receipt_url ?? undefined,
      policyLimit: Number(item.policy_limit) || 0,
      policyWarning: Boolean(Number(item.policy_warning)),
    })),
  };
}

async function idLookup(code: string): Promise<number> {
  const res = await apiFetch<PaginatedResponse<ApiExpense>>(
    `/admin/expenses?search=${encodeURIComponent(code)}&limit=5`
  );
  const row = res.data.find((r) => r.expense_code === code);
  if (!row) throw new Error(`Expense ${code} not found`);
  return row.expense_id;
}

export const expensesApi = {
  async list(): Promise<Expense[]> {
    const res = await apiFetch<PaginatedResponse<ApiExpense>>("/admin/expenses?limit=200");
    return (res.data ?? []).map(toUI);
  },
  async create(input: Omit<Expense, "id" | "createdBy">): Promise<Expense> {
    const res = await apiFetch<{ success: boolean; data: ApiExpense }>("/admin/expenses", {
      method: "POST",
      body: JSON.stringify(toApi(input)),
    });
    return toUI(res.data);
  },
  async update(id: string, patch: Partial<Expense>): Promise<Expense> {
    const numericId = await idLookup(id);
    const res = await apiFetch<{ success: boolean; data: ApiExpense }>(`/admin/expenses/${numericId}`, {
      method: "PUT",
      body: JSON.stringify(toApi(patch)),
    });
    return toUI(res.data);
  },
  async remove(id: string): Promise<void> {
    const numericId = await idLookup(id);
    await apiFetch<void>(`/admin/expenses/${numericId}`, { method: "DELETE" });
  },
};

export const expenseClaimsApi = {
  async list(status?: ExpenseClaimStatus | "all"): Promise<ExpenseClaim[]> {
    const query = status && status !== "all" ? `?status=${status}&limit=100` : "?limit=100";
    const res = await apiFetch<PaginatedResponse<ApiExpenseClaim>>(`/admin/expenses/claims${query}`);
    return (res.data ?? []).map(toClaim);
  },
  async policies(): Promise<ExpenseClaimPolicies> {
    const res = await apiFetch<{
      success: boolean;
      data: { category_limits: Record<string, number>; default_limit: number; mode: "warning" };
    }>("/admin/expenses/claims/policies");
    return {
      categoryLimits: res.data.category_limits,
      defaultLimit: Number(res.data.default_limit),
      mode: res.data.mode,
    };
  },
  async create(input: ExpenseClaimInput): Promise<ExpenseClaim> {
    const res = await apiFetch<{ success: boolean; data: ApiExpenseClaim }>("/admin/expenses/claims", {
      method: "POST",
      body: JSON.stringify({
        employee_key: input.employeeKey,
        purpose: input.purpose,
        items: input.items.map((item) => ({
          expense_date: item.expenseDate,
          category: item.category,
          description: item.description,
          amount: item.amount,
          receipt_url: item.receiptUrl,
        })),
      }),
    });
    return toClaim(res.data);
  },
  async approve(id: number, reason = ""): Promise<ExpenseClaim> {
    const res = await apiFetch<{ success: boolean; data: ApiExpenseClaim }>(`/admin/expenses/claims/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    return toClaim(res.data);
  },
  async reject(id: number, reason: string): Promise<ExpenseClaim> {
    const res = await apiFetch<{ success: boolean; data: ApiExpenseClaim }>(`/admin/expenses/claims/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    return toClaim(res.data);
  },
  async reimburse(id: number, reimbursementDate: string, reimbursementReference: string): Promise<ExpenseClaim> {
    const res = await apiFetch<{ success: boolean; data: ApiExpenseClaim }>(`/admin/expenses/claims/${id}/reimburse`, {
      method: "POST",
      body: JSON.stringify({
        reimbursement_date: reimbursementDate,
        reimbursement_reference: reimbursementReference,
      }),
    });
    return toClaim(res.data);
  },
};
