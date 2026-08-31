import { apiFetch } from "@/lib/api/client";
import type {
  OpsClient, OpsClientDetail, OpsProject, OpsMeeting, OpsBug,
  OpsPayment, OpsExpense, OpsAmcRecord, OpsPitch, OpsEmployee,
  OpsHiringCandidate, OpsDashboardStats, OpsFinanceSummary,
} from "@/types/ops";

function qs(p?: Record<string, string>) {
  if (!p || !Object.keys(p).length) return "";
  return "?" + new URLSearchParams(p).toString();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const opsDashboardApi = {
  stats: () => apiFetch<{ data: OpsDashboardStats }>("/admin/ops/dashboard-stats"),
};

// ─── Clients ─────────────────────────────────────────────────────────────────
export const opsClientsApi = {
  list:         (p?: Record<string, string>) => apiFetch<{ data: OpsClient[] }>(`/admin/ops/clients${qs(p)}`),
  get:          (id: number) => apiFetch<{ data: OpsClientDetail }>(`/admin/ops/clients/${id}`),
  create:       (body: Partial<OpsClient>) => apiFetch<{ data: OpsClient }>("/admin/ops/clients", { method: "POST", body: JSON.stringify(body) }),
  update:       (id: number, body: Partial<OpsClient>) => apiFetch<{ data: OpsClient }>(`/admin/ops/clients/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  advanceStage: (id: number, stage: string, done_by: string, notes?: string) =>
    apiFetch<{ data: OpsClient }>(`/admin/ops/clients/${id}/stage`, { method: "POST", body: JSON.stringify({ stage, done_by, notes }) }),
  checklistUpdate: (clientId: number, itemId: number, is_done: boolean, completed_by?: string) =>
    apiFetch<{ data: { updated: boolean } }>(`/admin/ops/clients/${clientId}/checklist/${itemId}`, { method: "PUT", body: JSON.stringify({ is_done, completed_by }) }),
  remove:       (id: number) => apiFetch<void>(`/admin/ops/clients/${id}`, { method: "DELETE" }),
};

// ─── Projects ─────────────────────────────────────────────────────────────────
export const opsProjectsApi = {
  list:   (p?: Record<string, string>) => apiFetch<{ data: OpsProject[] }>(`/admin/ops/projects${qs(p)}`),
  get:    (id: number) => apiFetch<{ data: OpsProject & { stage_history: any[]; bugs: any[]; meetings: any[]; payments: any[]; activity_log: any[] } }>(`/admin/ops/projects/${id}`),
  create: (body: Partial<OpsProject>) => apiFetch<{ data: OpsProject }>("/admin/ops/projects", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<OpsProject>) => apiFetch<{ data: OpsProject }>(`/admin/ops/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/admin/ops/projects/${id}`, { method: "DELETE" }),
};

// ─── Bugs ─────────────────────────────────────────────────────────────────────
export const opsBugsApi = {
  list:       (p?: Record<string, string>) => apiFetch<{ data: OpsBug[] }>(`/admin/ops/bugs${qs(p)}`),
  get:        (id: number) => apiFetch<{ data: OpsBug }>(`/admin/ops/bugs/${id}`),
  create:     (body: Partial<OpsBug>) => apiFetch<{ data: OpsBug }>("/admin/ops/bugs", { method: "POST", body: JSON.stringify(body) }),
  update:     (id: number, body: Partial<OpsBug>) => apiFetch<{ data: OpsBug }>(`/admin/ops/bugs/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  addComment: (id: number, comment: string, added_by: string) =>
    apiFetch<{ data: any }>(`/admin/ops/bugs/${id}/comments`, { method: "POST", body: JSON.stringify({ comment, added_by }) }),
  remove:     (id: number) => apiFetch<void>(`/admin/ops/bugs/${id}`, { method: "DELETE" }),
};

// ─── Meetings ─────────────────────────────────────────────────────────────────
export const opsMeetingsApi = {
  list:   (p?: Record<string, string>) => apiFetch<{ data: OpsMeeting[] }>(`/admin/ops/meetings${qs(p)}`),
  get:    (id: number) => apiFetch<{ data: OpsMeeting }>(`/admin/ops/meetings/${id}`),
  create: (body: Partial<OpsMeeting>) => apiFetch<{ data: OpsMeeting }>("/admin/ops/meetings", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<OpsMeeting>) => apiFetch<{ data: OpsMeeting }>(`/admin/ops/meetings/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/admin/ops/meetings/${id}`, { method: "DELETE" }),
};

// ─── Finance ──────────────────────────────────────────────────────────────────
export const opsFinanceApi = {
  summary:        (p?: Record<string, string>) => apiFetch<{ data: OpsFinanceSummary }>(`/admin/ops/finance/summary${qs(p)}`),
  payments:       (p?: Record<string, string>) => apiFetch<{ data: OpsPayment[] }>(`/admin/ops/finance/payments${qs(p)}`),
  addPayment:     (body: Partial<OpsPayment>) => apiFetch<{ data: OpsPayment }>("/admin/ops/finance/payments", { method: "POST", body: JSON.stringify(body) }),
  deletePayment:  (id: number) => apiFetch<void>(`/admin/ops/finance/payments/${id}`, { method: "DELETE" }),
  expenses:       (p?: Record<string, string>) => apiFetch<{ data: OpsExpense[] }>(`/admin/ops/finance/expenses${qs(p)}`),
  addExpense:     (body: Partial<OpsExpense>) => apiFetch<{ data: OpsExpense }>("/admin/ops/finance/expenses", { method: "POST", body: JSON.stringify(body) }),
  deleteExpense:  (id: number) => apiFetch<void>(`/admin/ops/finance/expenses/${id}`, { method: "DELETE" }),
};

// ─── AMC ──────────────────────────────────────────────────────────────────────
export const opsAmcApi = {
  list:   (p?: Record<string, string>) => apiFetch<{ data: OpsAmcRecord[] }>(`/admin/ops/amc${qs(p)}`),
  create: (body: Partial<OpsAmcRecord>) => apiFetch<{ data: OpsAmcRecord }>("/admin/ops/amc", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<OpsAmcRecord>) => apiFetch<{ data: OpsAmcRecord }>(`/admin/ops/amc/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/admin/ops/amc/${id}`, { method: "DELETE" }),
};

// ─── Pitches ──────────────────────────────────────────────────────────────────
export const opsPitchesApi = {
  list:   (p?: Record<string, string>) => apiFetch<{ data: OpsPitch[] }>(`/admin/ops/pitches${qs(p)}`),
  get:    (id: number) => apiFetch<{ data: OpsPitch }>(`/admin/ops/pitches/${id}`),
  create: (body: Partial<OpsPitch>) => apiFetch<{ data: OpsPitch }>("/admin/ops/pitches", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<OpsPitch>) => apiFetch<{ data: OpsPitch }>(`/admin/ops/pitches/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/admin/ops/pitches/${id}`, { method: "DELETE" }),
};

// ─── Hiring ───────────────────────────────────────────────────────────────────
export const opsHiringApi = {
  list:   (p?: Record<string, string>) => apiFetch<{ data: OpsHiringCandidate[] }>(`/admin/ops/hiring${qs(p)}`),
  create: (body: Partial<OpsHiringCandidate>) => apiFetch<{ data: OpsHiringCandidate }>("/admin/ops/hiring", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<OpsHiringCandidate>) => apiFetch<{ data: OpsHiringCandidate }>(`/admin/ops/hiring/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/admin/ops/hiring/${id}`, { method: "DELETE" }),
};

// ─── Employees ────────────────────────────────────────────────────────────────
export const opsEmployeesApi = {
  list:   (p?: Record<string, string>) => apiFetch<{ data: OpsEmployee[] }>(`/admin/ops/employees${qs(p)}`),
  get:    (id: number) => apiFetch<{ data: OpsEmployee }>(`/admin/ops/employees/${id}`),
  create: (body: Partial<OpsEmployee>) => apiFetch<{ data: OpsEmployee }>("/admin/ops/employees", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<OpsEmployee>) => apiFetch<{ data: OpsEmployee }>(`/admin/ops/employees/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number) => apiFetch<void>(`/admin/ops/employees/${id}`, { method: "DELETE" }),
};
