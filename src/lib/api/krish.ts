import { apiFetch } from "@/lib/api/client";
import type { Customer, Employee } from "@/types/krish";

function qs(p?: Record<string, string>) {
  if (!p || !Object.keys(p).length) return "";
  return "?" + new URLSearchParams(p).toString();
}

// ── Customers ────────────────────────────────────────────────────────────────
export const customersApi = {
  list:    (params?: Record<string, string>) => apiFetch<{ data: Customer[] }>(`/admin/customers${qs(params)}`),
  get:     (id: number)                       => apiFetch<{ data: Customer }>(`/admin/customers/${id}`),
  create:  (body: Partial<Customer>)          => apiFetch<{ data: Customer }>("/admin/customers", { method: "POST", body: JSON.stringify(body) }),
  update:  (id: number, body: Partial<Customer>) => apiFetch<{ data: Customer }>(`/admin/customers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove:  (id: number)                       => apiFetch<void>(`/admin/customers/${id}`, { method: "DELETE" }),
};


// ── Employees ─────────────────────────────────────────────────────────────────
export const employeesApi = {
  list:   (params?: Record<string, string>) => apiFetch<{ data: Employee[] }>(`/admin/employees${qs(params)}`),
  get:    (id: number)                       => apiFetch<{ data: Employee }>(`/admin/employees/${id}`),
  create: (body: Partial<Employee>)          => apiFetch<{ data: Employee }>("/admin/employees", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Employee>) => apiFetch<{ data: Employee }>(`/admin/employees/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number)                       => apiFetch<void>(`/admin/employees/${id}`, { method: "DELETE" }),
};
