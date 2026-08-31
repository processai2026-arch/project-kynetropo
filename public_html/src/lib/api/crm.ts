import { apiFetch } from "./client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type LeadStatus = "new" | "contacted" | "qualified" | "lost";
export type DealStage = "qualification" | "proposal" | "negotiation" | "won" | "lost";
export type ActivityType = "call" | "meeting" | "task" | "note";
export type RelatedType = "lead" | "deal" | "customer";

export interface ApiLead {
  lead_id: number;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  owner_id: number | null;
  notes: string | null;
  converted_customer_id: number | null;
  converted_deal_id: number | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string | null;
  activities?: ApiActivity[];
}

export interface ApiDeal {
  deal_id: number;
  title: string;
  customer_id: number | null;
  customer_name?: string | null;
  lead_id: number | null;
  value: number;
  currency: string;
  stage: DealStage;
  expected_close_date: string | null;
  owner_id: number | null;
  probability: number;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string | null;
  activities?: ApiActivity[];
}

export interface ApiActivity {
  activity_id: number;
  type: ActivityType;
  subject: string;
  notes: string | null;
  related_type: RelatedType;
  related_id: number;
  due_at: string | null;
  done: boolean;
  done_at: string | null;
  owner_id: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface ApiPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: ApiPagination;
}

interface ApiSingleResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export type DealsPipeline = Record<DealStage, ApiDeal[]>;

// ─── Leads ──────────────────────────────────────────────────────────────────

export async function fetchLeads(params: {
  page?: number;
  limit?: number;
  status?: LeadStatus | "";
  owner_id?: number | "";
  source?: string;
  search?: string;
} = {}): Promise<ApiPaginatedResponse<ApiLead>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.status) qs.set("status", params.status);
  if (params.owner_id) qs.set("owner_id", String(params.owner_id));
  if (params.source) qs.set("source", params.source);
  if (params.search) qs.set("search", params.search);
  return apiFetch<ApiPaginatedResponse<ApiLead>>(`/admin/crm/leads?${qs.toString()}`);
}

export async function fetchLead(id: number): Promise<ApiLead> {
  const res = await apiFetch<ApiSingleResponse<ApiLead>>(`/admin/crm/leads/${id}`);
  return res.data;
}

export async function createLead(data: Partial<ApiLead>): Promise<ApiLead> {
  const res = await apiFetch<ApiSingleResponse<ApiLead>>(`/admin/crm/leads`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateLead(id: number, data: Partial<ApiLead>): Promise<ApiLead> {
  const res = await apiFetch<ApiSingleResponse<ApiLead>>(`/admin/crm/leads/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteLead(id: number): Promise<void> {
  await apiFetch(`/admin/crm/leads/${id}`, { method: "DELETE" });
}

export async function convertLead(
  id: number,
  data: { create_deal?: boolean; deal_title?: string; deal_value?: number } = {}
): Promise<{ lead_id: number; customer_id: number; deal_id: number | null }> {
  const res = await apiFetch<ApiSingleResponse<{ lead_id: number; customer_id: number; deal_id: number | null }>>(
    `/admin/crm/leads/${id}/convert`,
    { method: "POST", body: JSON.stringify(data) }
  );
  return res.data;
}

// ─── Deals / Pipeline ───────────────────────────────────────────────────────

export async function fetchDeals(params: {
  page?: number;
  limit?: number;
  stage?: DealStage | "";
  owner_id?: number | "";
  customer_id?: number | "";
  search?: string;
} = {}): Promise<ApiPaginatedResponse<ApiDeal>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.stage) qs.set("stage", params.stage);
  if (params.owner_id) qs.set("owner_id", String(params.owner_id));
  if (params.customer_id) qs.set("customer_id", String(params.customer_id));
  if (params.search) qs.set("search", params.search);
  return apiFetch<ApiPaginatedResponse<ApiDeal>>(`/admin/crm/deals?${qs.toString()}`);
}

export async function fetchPipeline(owner_id?: number): Promise<DealsPipeline> {
  const qs = owner_id ? `?owner_id=${owner_id}` : "";
  const res = await apiFetch<ApiSingleResponse<DealsPipeline>>(`/admin/crm/deals/pipeline${qs}`);
  return res.data;
}

export async function fetchDeal(id: number): Promise<ApiDeal> {
  const res = await apiFetch<ApiSingleResponse<ApiDeal>>(`/admin/crm/deals/${id}`);
  return res.data;
}

export async function createDeal(data: Partial<ApiDeal>): Promise<ApiDeal> {
  const res = await apiFetch<ApiSingleResponse<ApiDeal>>(`/admin/crm/deals`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateDeal(id: number, data: Partial<ApiDeal>): Promise<ApiDeal> {
  const res = await apiFetch<ApiSingleResponse<ApiDeal>>(`/admin/crm/deals/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function changeDealStage(id: number, stage: DealStage): Promise<ApiDeal> {
  const res = await apiFetch<ApiSingleResponse<ApiDeal>>(`/admin/crm/deals/${id}/stage`, {
    method: "PUT",
    body: JSON.stringify({ stage }),
  });
  return res.data;
}

export async function deleteDeal(id: number): Promise<void> {
  await apiFetch(`/admin/crm/deals/${id}`, { method: "DELETE" });
}

// ─── Activities ─────────────────────────────────────────────────────────────

export async function fetchActivities(params: {
  page?: number;
  limit?: number;
  related_type?: RelatedType | "";
  related_id?: number | "";
  type?: ActivityType | "";
  done?: boolean | "";
  owner_id?: number | "";
} = {}): Promise<ApiPaginatedResponse<ApiActivity>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.related_type) qs.set("related_type", params.related_type);
  if (params.related_id) qs.set("related_id", String(params.related_id));
  if (params.type) qs.set("type", params.type);
  if (params.done !== undefined && params.done !== "") qs.set("done", String(params.done));
  if (params.owner_id) qs.set("owner_id", String(params.owner_id));
  return apiFetch<ApiPaginatedResponse<ApiActivity>>(`/admin/crm/activities?${qs.toString()}`);
}

export async function fetchTimeline(relatedType: RelatedType, relatedId: number): Promise<ApiActivity[]> {
  const res = await apiFetch<ApiSingleResponse<ApiActivity[]>>(
    `/admin/crm/activities/timeline/${relatedType}/${relatedId}`
  );
  return res.data;
}

export async function createActivity(data: Partial<ApiActivity>): Promise<ApiActivity> {
  const res = await apiFetch<ApiSingleResponse<ApiActivity>>(`/admin/crm/activities`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateActivity(id: number, data: Partial<ApiActivity>): Promise<ApiActivity> {
  const res = await apiFetch<ApiSingleResponse<ApiActivity>>(`/admin/crm/activities/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteActivity(id: number): Promise<void> {
  await apiFetch(`/admin/crm/activities/${id}`, { method: "DELETE" });
}
