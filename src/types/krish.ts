// TypeScript types for Krish Agencies

export interface Customer {
  id: number;
  name: string;
  contact_person: string | null;
  email: string;
  phone: string;
  address: string | null;
  city: string | null;
  state: string | null;
  status: "active" | "inactive";
  notes: string | null;
  user_id: number | null;
  created_at: string;
}

export interface Machine {
  id: number;
  machine_id: string;
  model: string;
  category: string | null;
  customer_id: number;
  customer_name?: string;
  location_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
  installed_date: string | null;
  warranty_expiry: string | null;
  status: "active" | "inactive" | "under_repair";
  notes: string | null;
  created_at: string;
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  designation: string | null;
  department: string | null;
  status: "active" | "inactive";
  notes: string | null;
  user_id: number | null;
  created_at: string;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  machine_id: number;
  machine_code?: string;
  machine_model?: string;
  customer_id: number;
  customer_name?: string;
  assigned_employee_id: number | null;
  employee_name?: string | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "assigned" | "in_progress" | "resolved" | "closed";
  raised_by: "customer" | "admin";
  work_notes: string | null;
  resolution_notes: string | null;
  assigned_at: string | null;
  started_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  notes?: TicketNote[];
}

export interface TicketNote {
  id: number;
  ticket_id: number;
  author_name: string;
  author_role: "admin" | "customer" | "employee";
  note: string;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string | null;
  description: string | null;
  unit: string;
  unit_price: number;
  stock_qty: number;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name?: string;
  status: "pending" | "confirmed" | "processing" | "dispatched" | "delivered" | "cancelled";
  total_amount: number;
  notes: string | null;
  delivery_address: string | null;
  order_date: string;
  expected_delivery: string | null;
  created_at: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface AttendanceLog {
  id: number;
  employee_id: number;
  employee_name?: string;
  date: string;
  check_in_time: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_time: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  location_name: string | null;
  status: "present" | "absent" | "half_day";
  hours_worked: number | null;
  method: "gps_auto" | "manual";
  notes: string | null;
  created_at: string;
}

export interface DashboardStats {
  open_tickets: number;
  in_progress_tickets: number;
  pending_orders: number;
  active_machines: number;
  present_today: number;
  total_employees: number;
}
