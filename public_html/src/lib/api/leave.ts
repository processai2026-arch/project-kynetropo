import { apiFetch } from "@/lib/api/client";

type Envelope<T> = { data: T; message?: string };

export type LeaveStatus = "submitted" | "approved" | "rejected";

export type LeaveEmployee = {
  id: string;
  name: string;
  department?: string;
  designation?: string;
  active: boolean;
};

export type LeaveType = {
  leave_type_id: number;
  name: string;
  annual_quota: number;
  is_paid: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
};

export type LeaveRequest = {
  leave_request_id: number;
  employee_key: string;
  employee_name?: string | null;
  department?: string | null;
  leave_type_id: number;
  leave_type_name?: string | null;
  is_paid?: boolean | null;
  start_date: string;
  end_date: string;
  requested_days: number;
  balance_year: number;
  reason?: string | null;
  status: LeaveStatus;
  submitted_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
};

export type LeaveBalance = {
  balance_id?: number | null;
  employee_key: string;
  employee_name: string;
  department?: string | null;
  leave_type_id: number;
  leave_type_name: string;
  annual_quota: number;
  is_paid: boolean;
  balance_year: number;
  opening_balance: number;
  accrued_days: number;
  adjusted_days: number;
  used_days: number;
  available_days: number;
  last_accrual_at?: string | null;
};

export type LeaveRegisterType = {
  leave_type_id: number;
  leave_type_name: string;
  is_paid: boolean;
  opening: number;
  accrued: number;
  adjusted: number;
  taken: number;
  pending: number;
  closing: number;
  transaction_count: number;
};

export type LeaveRegisterEmployee = {
  employee_key: string;
  employee_name: string;
  department?: string | null;
  designation?: string | null;
  attendance_leave_days: number;
  attendance_conflicts: number;
  payroll_months: string[];
  payroll_leave_days: number;
  types: LeaveRegisterType[];
  requests: LeaveRequest[];
};

export type LeaveRegister = {
  year: number;
  from: string;
  to: string;
  employees: LeaveRegisterEmployee[];
};

export type LeaveRequestPayload = {
  employeeId: string;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  reason?: string;
};

export type LeaveTypePayload = {
  name: string;
  annualQuota: number;
  isPaid: boolean;
  isActive?: boolean;
};

const queryString = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : "";
};

export const leaveApi = {
  employees: async (): Promise<LeaveEmployee[]> =>
    (await apiFetch<Envelope<LeaveEmployee[]>>("/admin/employees?active=1")).data ?? [],

  types: async (activeOnly = false): Promise<LeaveType[]> =>
    (await apiFetch<Envelope<LeaveType[]>>(`/admin/leave/types${activeOnly ? "?active=1" : ""}`)).data ?? [],

  createType: async (payload: LeaveTypePayload): Promise<LeaveType> =>
    (await apiFetch<Envelope<LeaveType>>("/admin/leave/types", {
      method: "POST",
      body: JSON.stringify(payload),
    })).data,

  updateType: async (id: number, payload: Partial<LeaveTypePayload>): Promise<LeaveType> =>
    (await apiFetch<Envelope<LeaveType>>(`/admin/leave/types/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })).data,

  requests: async (params: {
    status?: LeaveStatus | "";
    employeeId?: string;
    from?: string;
    to?: string;
  } = {}): Promise<LeaveRequest[]> =>
    (await apiFetch<Envelope<LeaveRequest[]>>(`/admin/leave/requests${queryString(params)}`)).data ?? [],

  submitRequest: async (payload: LeaveRequestPayload): Promise<LeaveRequest> =>
    (await apiFetch<Envelope<LeaveRequest>>("/admin/leave/requests", {
      method: "POST",
      body: JSON.stringify(payload),
    })).data,

  approveRequest: async (id: number): Promise<LeaveRequest> =>
    (await apiFetch<Envelope<LeaveRequest>>(`/admin/leave/requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    })).data,

  rejectRequest: async (id: number, reason: string): Promise<LeaveRequest> =>
    (await apiFetch<Envelope<LeaveRequest>>(`/admin/leave/requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })).data,

  balances: async (year: number, employeeId = ""): Promise<LeaveBalance[]> =>
    (await apiFetch<Envelope<LeaveBalance[]>>(
      `/admin/leave/balances${queryString({ year, employeeId })}`,
    )).data ?? [],

  register: async (params: { year: number; from?: string; to?: string }): Promise<LeaveRegister> =>
    (await apiFetch<Envelope<LeaveRegister>>(
      `/admin/leave/register${queryString(params)}`,
    )).data,

  accrue: async (payload: {
    employeeId: string;
    leaveTypeId: number;
    year: number;
    days: number;
    notes?: string;
  }): Promise<LeaveBalance> =>
    (await apiFetch<Envelope<LeaveBalance>>("/admin/leave/balances/accrue", {
      method: "POST",
      body: JSON.stringify(payload),
    })).data,

  calendar: async (from: string, to: string): Promise<LeaveRequest[]> =>
    (await apiFetch<Envelope<LeaveRequest[]>>(
      `/admin/leave/calendar${queryString({ from, to })}`,
    )).data ?? [],
};
