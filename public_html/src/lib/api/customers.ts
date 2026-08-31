import { apiFetch } from "./client";

export interface ApiUser {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  user_type: string;
  company_name?: string | null;
  address?: string | null;
  city: string | null;
  state?: string | null;
  pincode?: string | null;
  gst_number?: string | null;
  udyam_number?: string | null;
  is_active: boolean;
  created_at: string;
  total_orders: number;
  total_spent: number;
  last_order_at?: string | null;
  health_score?: number | null;
  segment?: string | null;
  is_at_risk?: boolean;
  is_high_value?: boolean;
}

export interface ApiUsersResponse {
  success: boolean;
  data: ApiUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiUserOrderStats {
  user_id: number;
  total_orders: number;
  active_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  total_spent: number;
}

export interface ApiLastOrder {
  order_id: number;
  order_number: string;
  total_amount: number;
  order_status: string;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_pincode: string | null;
  created_at: string;
}

export interface ApiCustomerHealth {
  customer_id: number;
  tenant_id: number;
  recency_score: number;
  frequency_score: number;
  monetary_score: number;
  payment_score: number;
  health_score: number;
  segment: string;
  is_at_risk: boolean;
  is_high_value: boolean;
  total_orders: number;
  orders_last_12m: number;
  total_spend: number;
  avg_order_value: number;
  overdue_amount: number;
  overdue_invoices: number;
  max_days_overdue: number;
  last_order_at: string | null;
  days_since_last_order: number | null;
  computed_at: string;
}

export interface ApiCustomerDetail {
  user: ApiUser;
  last_order: ApiLastOrder | null;
  health: ApiCustomerHealth | null;
}

export interface ApiCustomerHealthDashboard {
  customers: (ApiCustomerHealth & { name: string; email: string; phone: string; city: string | null; is_active: boolean })[];
  at_risk: ApiCustomerHealthDashboard["customers"];
  high_value: ApiCustomerHealthDashboard["customers"];
  segment_counts: Record<string, number>;
  computed_customers: number;
}

export interface CustomerEditInput {
  name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gst_number?: string;
  udyam_number?: string;
}

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone: string;
  password: string;
  company_name?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export async function createCustomer(
  input: CreateCustomerInput
): Promise<{ user_id: number; email_sent: boolean } & Record<string, any>> {
  const res = await apiFetch<{ success: boolean; message: string; data: any }>("/admin/users", {
    method: "POST",
    body: JSON.stringify({ user_type: "customer", ...input }),
  });
  return res.data;
}

// Fetch list of customers
export async function fetchCustomers(limit = 100, userType = "customer"): Promise<ApiUser[]> {
  const res = await apiFetch<ApiUsersResponse>(`/admin/users?limit=${limit}&user_type=${userType}`);
  return res.data ?? [];
}

// Fetch per-status order breakdown for one user
export async function fetchCustomerOrderStats(userId: number): Promise<ApiUserOrderStats> {
  const res = await apiFetch<{ success: boolean; data: ApiUserOrderStats }>(
    `/admin/users/${userId}/stats`
  );
  return res.data;
}

// Fetch the full customer-master detail (profile + last order + health score)
export async function fetchCustomerDetail(userId: number): Promise<ApiCustomerDetail> {
  const res = await apiFetch<{ success: boolean; data: ApiCustomerDetail }>(
    `/admin/users/${userId}/detail`
  );
  return res.data;
}

// Update active status
export async function updateCustomerStatus(id: number, isActive: boolean): Promise<void> {
  await apiFetch(`/admin/users/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ is_active: isActive }),
  });
}

// Full customer-master edit: name, contact, address/city/state/pincode, GST/Udyam
export async function updateCustomer(id: number, input: CustomerEditInput): Promise<ApiUser> {
  const res = await apiFetch<{ success: boolean; data: ApiUser }>(`/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return res.data;
}

// Admin-initiated password reset — actually sets + emails a new credential
export async function resetCustomerPassword(
  id: number
): Promise<{ user_id: number; email_sent: boolean; new_password?: string }> {
  const res = await apiFetch<{
    success: boolean;
    message: string;
    data: { user_id: number; email_sent: boolean; new_password?: string };
  }>(`/admin/users/${id}/reset-password`, { method: "POST" });
  return res.data;
}

// Tenant-scoped retention dashboard: every customer's health score + at-risk/high-value lists
export async function fetchCustomerHealthDashboard(recompute = false): Promise<ApiCustomerHealthDashboard> {
  const res = await apiFetch<{ success: boolean; data: ApiCustomerHealthDashboard }>(
    `/admin/customers/health${recompute ? "?recompute=1" : ""}`,
    { skipCache: recompute }
  );
  return res.data;
}

// Recompute a single customer's health score on demand
export async function recomputeCustomerHealth(id: number): Promise<ApiCustomerHealth> {
  const res = await apiFetch<{ success: boolean; data: ApiCustomerHealth }>(
    `/admin/users/${id}/recompute-health`,
    { method: "POST" }
  );
  return res.data;
}

function fmt(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export const SEGMENT_LABELS: Record<string, string> = {
  champion: "Champion",
  loyal: "Loyal",
  at_risk: "At Risk",
  new: "New",
  dormant: "Dormant",
};

export function mapApiUserToUI(u: ApiUser, stats?: ApiUserOrderStats): any {
  return {
    id: u.user_id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    userType: u.user_type === "dealer" ? "Dealer" : "Customer",
    companyName: u.company_name ?? "",
    deliveryAddress: u.address ?? "—",
    city: u.city ?? "—",
    state: u.state ?? "",
    pincode: u.pincode ?? "—",
    gstNumber: u.gst_number ?? "",
    udyamNumber: u.udyam_number ?? "",
    orders: stats?.total_orders ?? u.total_orders,
    lastOrder: formatDate(u.last_order_at),
    totalSpent: fmt(stats?.total_spent ?? u.total_spent),
    cancelledOrders: stats?.cancelled_orders ?? 0,
    accountCreatedDate: formatDate(u.created_at),
    activeOrders: stats?.active_orders ?? 0,
    deliveredOrders: stats?.delivered_orders ?? 0,
    returnedOrders: stats?.returned_orders ?? 0,
    isActive: u.is_active,
    healthScore: u.health_score ?? null,
    segment: u.segment ?? null,
    segmentLabel: u.segment ? SEGMENT_LABELS[u.segment] ?? u.segment : null,
    isAtRisk: u.is_at_risk ?? false,
    isHighValue: u.is_high_value ?? false,
  };
}
