import { apiFetch } from "@/lib/api/client";

export interface DropdownOption {
  value: string;
  is_custom: boolean;
}

export const dropdownOptionsApi = {
  async list(key: string): Promise<DropdownOption[]> {
    const res = await apiFetch<{ data: { options: DropdownOption[] } }>(`/admin/dropdown-options/${key}`);
    return res.data?.options ?? [];
  },
  async add(key: string, value: string): Promise<DropdownOption[]> {
    const res = await apiFetch<{ data: { options: DropdownOption[] } }>(`/admin/dropdown-options/${key}`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });
    return res.data?.options ?? [];
  },
  async remove(key: string, value: string): Promise<void> {
    await apiFetch<void>(`/admin/dropdown-options/${key}/${encodeURIComponent(value)}`, { method: "DELETE" });
  },
};
