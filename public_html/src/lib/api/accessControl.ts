import { apiFetch } from "./client";

export interface Role {
  role_id: number;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
}

export interface RolesResponse {
  roles: Role[];
  catalog: Record<string, string[]>;
}

export interface AuditEntry {
  audit_id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  table_name: string;
  record_id: number | null;
  old_value: string | null;
  new_value: string | null;
  ip_address: string | null;
  created_at: string;
}

export const accessApi = {
  async roles(): Promise<RolesResponse> {
    const res = await apiFetch<{ data: RolesResponse }>("/admin/roles");
    return res.data;
  },
  async createRole(body: { name: string; description?: string; permissions: string[] }): Promise<Role> {
    const res = await apiFetch<{ data: Role }>("/admin/roles", { method: "POST", body: JSON.stringify(body) });
    return res.data;
  },
  async updateRole(id: number, body: Partial<{ name: string; description: string; permissions: string[] }>): Promise<Role> {
    const res = await apiFetch<{ data: Role }>(`/admin/roles/${id}`, { method: "PUT", body: JSON.stringify(body) });
    return res.data;
  },
  async deleteRole(id: number): Promise<void> {
    await apiFetch<void>(`/admin/roles/${id}`, { method: "DELETE" });
  },
  async assign(roleId: number, userId: number): Promise<void> {
    await apiFetch<void>(`/admin/roles/${roleId}/assign`, { method: "POST", body: JSON.stringify({ user_id: userId }) });
  },
  async unassign(roleId: number, userId: number): Promise<void> {
    await apiFetch<void>(`/admin/roles/${roleId}/unassign`, { method: "POST", body: JSON.stringify({ user_id: userId }) });
  },
  // MFA
  async mfaStatus(): Promise<{ enrolled: boolean; enabled: boolean }> {
    const res = await apiFetch<{ data: { enrolled: boolean; enabled: boolean } }>("/admin/security/mfa");
    return res.data;
  },
  async mfaEnroll(): Promise<{ secret: string; otpauth_uri: string }> {
    const res = await apiFetch<{ data: { secret: string; otpauth_uri: string } }>("/admin/security/mfa/enroll", { method: "POST" });
    return res.data;
  },
  async mfaVerify(code: string): Promise<void> {
    await apiFetch<void>("/admin/security/mfa/verify", { method: "POST", body: JSON.stringify({ code }) });
  },
  async mfaDisable(): Promise<void> {
    await apiFetch<void>("/admin/security/mfa/disable", { method: "POST" });
  },
  async audit(page = 1): Promise<{ data: AuditEntry[]; pagination: { total: number; total_pages: number; page: number } }> {
    return apiFetch(`/admin/security/audit?page=${page}&limit=50`);
  },
};
