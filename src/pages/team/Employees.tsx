import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { opsEmployeesApi } from "@/lib/api/ops";
import type { OpsEmployee } from "@/types/ops";
import { Users, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  founder: "Founder", qa_tester: "QA Tester", sales_caller: "Sales Caller",
  trainer: "Trainer", developer: "Developer", other: "Other",
};
const accessLabels: Record<string, string> = {
  full: "Full Access", bugs_only: "Bugs Only",
  clients_readonly: "Clients (Read)", clients_followups: "Clients + Follow-ups",
};
const statusStyles: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
};

const EMPTY: Partial<OpsEmployee> = {
  name: "", phone: "", email: "", role: "other", access_level: "clients_readonly",
  monthly_pay: 0, start_date: "", status: "active", notes: "",
};

export default function Employees() {
  const [items, setItems]         = useState<OpsEmployee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatus] = useState("active");
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<OpsEmployee | null>(null);
  const [form, setForm]           = useState<Partial<OpsEmployee>>(EMPTY);
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await opsEmployeesApi.list(params);
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load employees"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const set = (k: keyof OpsEmployee, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit   = (e: OpsEmployee) => { setEditing(e); setForm({ ...e }); setFormOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      if (editing) { await opsEmployeesApi.update(editing.id, form); toast.success("Employee updated"); }
      else         { await opsEmployeesApi.create(form);              toast.success("Employee added"); }
      setFormOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally       { setSaving(false); }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm("Deactivate this employee?")) return;
    try { await opsEmployeesApi.remove(id); toast.success("Employee deactivated"); load(); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Employee</Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">Team ({items.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Name","Phone","Email","Role","Access Level","Monthly Pay","Start Date","Status",""].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 9 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-8 text-center text-muted-foreground text-sm">No employees found</td></tr>
                )}
                {!loading && items.map(emp => (
                  <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-card-foreground">{emp.name}</td>
                    <td className="py-3 px-4 text-card-foreground">{emp.phone || "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{emp.email || "—"}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs capitalize">{roleLabels[emp.role] ?? emp.role}</Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-card-foreground">{accessLabels[emp.access_level] ?? emp.access_level}</td>
                    <td className="py-3 px-4 text-card-foreground">
                      {emp.monthly_pay > 0 ? "₹" + Number(emp.monthly_pay).toLocaleString("en-IN") : "—"}
                    </td>
                    <td className="py-3 px-4 text-card-foreground">{emp.start_date ?? "—"}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", statusStyles[emp.status] ?? "bg-muted text-muted-foreground")}>{emp.status}</Badge>
                    </td>
                    <td className="py-3 px-4 flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role ?? "other"} onValueChange={v => set("role", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Access Level</Label>
                <Select value={form.access_level ?? "clients_readonly"} onValueChange={v => set("access_level", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(accessLabels).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Monthly Pay (₹)</Label>
                <Input type="number" value={form.monthly_pay ?? ""} onChange={e => set("monthly_pay", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date ?? ""} onChange={e => set("start_date", e.target.value)} />
              </div>
              {editing && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status ?? "active"} onValueChange={v => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add Employee"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
