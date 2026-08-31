import { apiFetch } from "./client";

export type QueryStatus = "New" | "In Progress" | "Waiting on Customer" | "Resolved" | "Closed";
export type QueryPriority = "low" | "normal" | "high" | "urgent";
export interface QueryMessage { message_id: number; sender_type: "customer"|"staff"|"system"; sender_name?: string|null; message: string; delivery_status: string; delivery_error?: string|null; created_at: string; }
export interface Query { query_id:number; query_number:string; name:string; email:string; message:string; admin_reply:string; status:QueryStatus; assigned_to:number|null; assigned_to_name:string|null; priority:QueryPriority; sla_due_at:string|null; sla_breached:boolean; created_at:string; message_count?:number; messages?:QueryMessage[]; }
export interface StaffUser { user_id:number; name:string; email:string; staff_role?:string|null; }
type Env<T>={success:boolean;data:T}; type Pag<T>={success:boolean;data:T[]};

export const queriesApi = {
  list: () => apiFetch<Pag<Query>>("/admin/queries?limit=100").then(r=>r.data??[]),
  show: (id:number) => apiFetch<Env<Query>>(`/admin/queries/${id}`).then(r=>r.data),
  staff: () => apiFetch<Env<StaffUser[]>>("/admin/queries/staff").then(r=>r.data??[]),
  update: (id:number,payload:{message?:string;status:QueryStatus;priority:QueryPriority;assigned_to:number|null;sla_due_at:string|null}) =>
    apiFetch<Env<Query>>(`/admin/queries/${id}/reply`,{method:"PUT",body:JSON.stringify(payload)}).then(r=>r.data),
};
