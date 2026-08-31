import { apiFetch } from "./client";

export interface CustomerUser {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  user_type: string;
  company_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

export interface ProductConfiguration {
  config_id: number;
  product_id?: number;
  size: string;
  purpose: string;
  sub_purpose?: string | null;
  price: number;
  is_available?: boolean;
}

export interface Product {
  product_id: number;
  product_name: string;
  product_type: string;
  description?: string | null;
  base_price: number;
  unit?: string | null;
  category?: string | null;
  tag?: string | null;
  tag_color?: string | null;
  suitable_for?: string | null;
  image_url?: string | null;
  is_available: boolean;
  configurations?: ProductConfiguration[];
  available_sizes?: string[];
}

export interface ProductPrice {
  product_id: number;
  product_name: string;
  size: string;
  purpose?: string | null;
  config_id?: number | null;
  price: number;
  source: "config" | "base_price";
}

export interface OrderItem {
  item_id: number;
  product_id: number;
  config_id?: number | null;
  product_name: string;
  product_type?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  size?: string | null;
  purpose?: string | null;
  sub_purpose?: string | null;
}

export interface OrderHistory {
  history_id: number;
  from_status?: string | null;
  to_status: string;
  note?: string | null;
  changed_by_name?: string | null;
  created_at: string;
}

export interface CustomerOrder {
  order_id: number;
  order_number: string;
  total_amount: number;
  delivery_fee: number;
  order_status: string;
  payment_status: string;
  payment_method?: string | null;
  tracking_number?: string | null;
  carrier?: string | null;
  delivery_address?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_pincode?: string | null;
  notes?: string | null;
  created_at: string;
  total_items?: number;
  items?: OrderItem[];
  history?: OrderHistory[];
}

export interface LoginData {
  token: string;
  refresh_token: string;
  user: CustomerUser;
}

type Envelope<T> = { success: boolean; data: T; message?: string };
type Paginated<T> = { success: boolean; data: T[]; pagination?: Record<string, number> };

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
};

export const customerApi = {
  products: () => apiFetch<Paginated<Product>>("/products?limit=100").then((response) => response.data ?? []),
  product: (id: number) => apiFetch<Envelope<Product>>(`/products/${id}`).then((response) => response.data),
  productPrice: (id: number, size: string, purpose?: string) =>
    apiFetch<Envelope<ProductPrice>>(`/products/${id}/price${query({ size, purpose })}`).then((response) => response.data),
  productSizes: (id: number) =>
    apiFetch<Envelope<{ available_sizes: string[] }>>(`/products/${id}/sizes`).then((response) => response.data.available_sizes ?? []),
  productConfigurations: (id: number) =>
    apiFetch<Envelope<ProductConfiguration[]>>(`/products/${id}/configurations`).then((response) => response.data ?? []),
  register: (payload: { name: string; email: string; phone: string; password: string; company_name?: string }) =>
    apiFetch<Envelope<{ user_id: number; approval_status?: string; message?: string }>>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ user_type: "customer", ...payload }),
    }),
  login: (identifier: string, password: string) =>
    apiFetch<Envelope<LoginData>>("/auth/login", {
      method: "POST",
      body: JSON.stringify(identifier.includes("@") ? { email: identifier, password } : { phone: identifier, password }),
    }),
  me: () => apiFetch<Envelope<CustomerUser>>("/auth/me", { skipCache: true }).then((response) => response.data),
  logout: () => apiFetch<Envelope<null>>("/auth/logout", { method: "POST" }),
  createOrder: (payload: {
    items: Array<{ product_id: number; config_id?: number | null; quantity: number }>;
    payment_method?: string;
    delivery_address: string;
    delivery_city?: string;
    delivery_state?: string;
    delivery_pincode?: string;
    notes?: string;
  }) => apiFetch<Envelope<CustomerOrder>>("/orders", { method: "POST", body: JSON.stringify(payload) }).then((response) => response.data),
  myOrders: () => apiFetch<Paginated<CustomerOrder>>("/orders?limit=100").then((response) => response.data ?? []),
  order: (id: number) => apiFetch<Envelope<CustomerOrder>>(`/orders/${id}`).then((response) => response.data),
  updateProfile: (id: number, payload: Partial<Pick<CustomerUser, "name" | "email" | "phone" | "address" | "city" | "state" | "pincode">>) =>
    apiFetch<Envelope<CustomerUser>>(`/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }).then((response) => response.data),
  changePassword: (id: number, payload: { current_password: string; new_password: string; confirm_password: string }) =>
    apiFetch<Envelope<null>>(`/users/${id}/password`, { method: "PUT", body: JSON.stringify(payload) }),
  forgotPassword: (identifier: string) =>
    apiFetch<Envelope<{ identifier: string; identifier_type: string }>>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(identifier.includes("@") ? { email: identifier } : { phone: identifier }),
    }),
  verifyResetOtp: (identifier: string, otp: string) =>
    apiFetch<Envelope<{ reset_token: string }>>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ identifier, otp, purpose: "password_reset" }),
    }),
  resetPassword: (resetToken: string, newPassword: string) =>
    apiFetch<Envelope<unknown>>("/auth/reset-password", {
      method: "POST",
      headers: { Authorization: `Bearer ${resetToken}` },
      body: JSON.stringify({ new_password: newPassword, confirm_password: newPassword }),
    }),
};
