import { apiFetch } from "@/lib/api/client";
import type {
  Customer, Machine, Employee, Ticket, TicketNote,
  Product, Order, OrderItem, AttendanceLog, DashboardStats,
} from "@/types/krish";

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

// ── Machines ─────────────────────────────────────────────────────────────────
export const machinesApi = {
  list:   (params?: Record<string, string>) => apiFetch<{ data: Machine[] }>(`/admin/machines${qs(params)}`),
  get:    (id: number)                       => apiFetch<{ data: Machine }>(`/admin/machines/${id}`),
  create: (body: Partial<Machine>)           => apiFetch<{ data: Machine }>("/admin/machines", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Machine>) => apiFetch<{ data: Machine }>(`/admin/machines/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number)                       => apiFetch<void>(`/admin/machines/${id}`, { method: "DELETE" }),
};

// ── Employees ─────────────────────────────────────────────────────────────────
export const employeesApi = {
  list:   (params?: Record<string, string>) => apiFetch<{ data: Employee[] }>(`/admin/employees${qs(params)}`),
  get:    (id: number)                       => apiFetch<{ data: Employee }>(`/admin/employees/${id}`),
  create: (body: Partial<Employee>)          => apiFetch<{ data: Employee }>("/admin/employees", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Employee>) => apiFetch<{ data: Employee }>(`/admin/employees/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number)                       => apiFetch<void>(`/admin/employees/${id}`, { method: "DELETE" }),
};

// ── Tickets ───────────────────────────────────────────────────────────────────
export const ticketsApi = {
  list:    (params?: Record<string, string>) => apiFetch<{ data: Ticket[] }>(`/admin/tickets${qs(params)}`),
  get:     (id: number)                       => apiFetch<{ data: Ticket }>(`/admin/tickets/${id}`),
  create:  (body: Partial<Ticket>)            => apiFetch<{ data: Ticket }>("/admin/tickets", { method: "POST", body: JSON.stringify(body) }),
  update:  (id: number, body: Partial<Ticket>) => apiFetch<{ data: Ticket }>(`/admin/tickets/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove:  (id: number)                       => apiFetch<void>(`/admin/tickets/${id}`, { method: "DELETE" }),
  notes:   (id: number)                       => apiFetch<{ data: TicketNote[] }>(`/admin/tickets/${id}/notes`),
  addNote: (id: number, body: { note: string; author_name?: string; author_role?: string }) =>
    apiFetch<{ data: TicketNote }>(`/admin/tickets/${id}/notes`, { method: "POST", body: JSON.stringify(body) }),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productsApi = {
  list:   (params?: Record<string, string>) => apiFetch<{ data: Product[] }>(`/admin/products${qs(params)}`),
  get:    (id: number)                       => apiFetch<{ data: Product }>(`/admin/products/${id}`),
  create: (body: Partial<Product>)           => apiFetch<{ data: Product }>("/admin/products", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Product>) => apiFetch<{ data: Product }>(`/admin/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number)                       => apiFetch<void>(`/admin/products/${id}`, { method: "DELETE" }),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  list:   (params?: Record<string, string>) => apiFetch<{ data: Order[] }>(`/admin/orders${qs(params)}`),
  get:    (id: number)                       => apiFetch<{ data: Order }>(`/admin/orders/${id}`),
  create: (body: { customer_id: number; items: { product_id: number; quantity: number }[]; notes?: string; delivery_address?: string }) =>
    apiFetch<{ data: Order }>("/admin/orders", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Order>) => apiFetch<{ data: Order }>(`/admin/orders/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number)                       => apiFetch<void>(`/admin/orders/${id}`, { method: "DELETE" }),
};

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceApi = {
  list:     (params?: Record<string, string>) => apiFetch<{ data: AttendanceLog[] }>(`/admin/attendance${qs(params)}`),
  checkIn:  (body: { employee_id?: number; latitude?: number; longitude?: number }) =>
    apiFetch<{ data: AttendanceLog }>("/admin/attendance/check-in", { method: "POST", body: JSON.stringify(body) }),
  checkOut: (body: { employee_id?: number; latitude?: number; longitude?: number }) =>
    apiFetch<{ data: AttendanceLog }>("/admin/attendance/check-out", { method: "POST", body: JSON.stringify(body) }),
  manual:   (body: Partial<AttendanceLog>)    =>
    apiFetch<{ data: AttendanceLog }>("/admin/attendance/manual", { method: "POST", body: JSON.stringify(body) }),
  update:   (id: number, body: Partial<AttendanceLog>) =>
    apiFetch<{ data: AttendanceLog }>(`/admin/attendance/${id}`, { method: "PUT", body: JSON.stringify(body) }),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => apiFetch<{ data: DashboardStats & { recent_tickets: Ticket[]; recent_orders: Order[] } }>("/admin/dashboard-stats"),
};

// ── Customer Portal ───────────────────────────────────────────────────────────
export const customerPortalApi = {
  stats:       ()                             => apiFetch<{ data: object }>("/customer/dashboard-stats"),
  machines:    ()                             => apiFetch<{ data: Machine[] }>("/customer/machines"),
  tickets:     (params?: Record<string, string>) => apiFetch<{ data: Ticket[] }>(`/customer/tickets${qs(params)}`),
  getTicket:   (id: number)                   => apiFetch<{ data: Ticket }>(`/customer/tickets/${id}`),
  raiseTicket: (body: { machine_id: number; title: string; description?: string; priority?: string }) =>
    apiFetch<{ data: Ticket }>("/customer/tickets", { method: "POST", body: JSON.stringify(body) }),
  addTicketNote: (id: number, note: string)   =>
    apiFetch<{ data: TicketNote }>(`/customer/tickets/${id}/notes`, { method: "POST", body: JSON.stringify({ note }) }),
  products:    ()                             => apiFetch<{ data: Product[] }>("/customer/products"),
  orders:      (params?: Record<string, string>) => apiFetch<{ data: Order[] }>(`/customer/orders${qs(params)}`),
  getOrder:    (id: number)                   => apiFetch<{ data: Order }>(`/customer/orders/${id}`),
  placeOrder:  (body: { items: { product_id: number; quantity: number }[]; notes?: string; delivery_address?: string }) =>
    apiFetch<{ data: Order }>("/customer/orders", { method: "POST", body: JSON.stringify(body) }),
};

// ── Employee Portal ───────────────────────────────────────────────────────────
export const employeePortalApi = {
  stats:       ()                             => apiFetch<{ data: object }>("/employee/dashboard-stats"),
  tickets:     (params?: Record<string, string>) => apiFetch<{ data: Ticket[] }>(`/employee/tickets${qs(params)}`),
  getTicket:   (id: number)                   => apiFetch<{ data: Ticket }>(`/employee/tickets/${id}`),
  updateTicket:(id: number, body: { status?: string; work_notes?: string; resolution_notes?: string }) =>
    apiFetch<{ data: Ticket }>(`/employee/tickets/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  addNote:     (id: number, note: string)     =>
    apiFetch<{ data: TicketNote }>(`/employee/tickets/${id}/notes`, { method: "POST", body: JSON.stringify({ note }) }),
  attendanceToday: ()                         => apiFetch<{ data: AttendanceLog }>("/employee/attendance/today"),
  attendance:  (params?: Record<string, string>) => apiFetch<{ data: AttendanceLog[] }>(`/employee/attendance${qs(params)}`),
  checkIn:     (body: { latitude?: number; longitude?: number }) =>
    apiFetch<{ data: AttendanceLog }>("/employee/attendance/check-in", { method: "POST", body: JSON.stringify(body) }),
  checkOut:    (body: { latitude?: number; longitude?: number }) =>
    apiFetch<{ data: AttendanceLog }>("/employee/attendance/check-out", { method: "POST", body: JSON.stringify(body) }),
};
