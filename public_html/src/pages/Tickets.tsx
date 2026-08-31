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
import { ticketsApi, employeesApi, machinesApi } from "@/lib/api/krish";
import type { Ticket, Employee, Machine } from "@/types/krish";
import { Ticket as TicketIcon, Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  open:        "bg-red-50 text-red-600 border-red-200",
  assigned:    "bg-blue-50 text-blue-600 border-blue-200",
  in_progress: "bg-amber-50 text-amber-600 border-amber-200",
  resolved:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed:      "bg-gray-100 text-gray-500 border-gray-200",
};

const priorityStyles: Record<string, string> = {
  low:    "bg-gray-100 text-gray-500 border-gray-200",
  medium: "bg-blue-50 text-blue-600 border-blue-200",
  high:   "bg-amber-50 text-amber-600 border-amber-200",
  urgent: "bg-red-50 text-red-600 border-red-200",
};

const EMPTY = {
  machine_id: 0, title: "", description: "", priority: "medium" as const,
  status: "open" as const, assigned_employee_id: 0,
  work_notes: "", resolution_notes: "", raised_by: "admin" as const,
};

export default function Tickets() {
  const [items, setItems]         = useState<Ticket[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [machines, setMachines]   = useState<Machine[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<Ticket | null>(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [derivedCustomer, setDerivedCustomer] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      if (search) params.search = search;
      const res = await ticketsApi.list(params);
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load tickets"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter, priorityFilter]);

  useEffect(() => {
    employeesApi.list({ status: "active" }).then(r => setEmployees((r as any).data ?? [])).catch(() => {});
    machinesApi.list({ status: "active" }).then(r => setMachines((r as any).data ?? [])).catch(() => {});
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleMachineChange = (machineId: number) => {
    set("machine_id", machineId);
    const m = machines.find(m => m.id === machineId);
    setDerivedCustomer(m?.customer_name ?? "");
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setDerivedCustomer("");
    setFormOpen(true);
  };

  const openEdit = (t: Ticket) => {
    setEditing(t);
    setForm({
      machine_id: t.machine_id, title: t.title, description: t.description ?? "",
      priority: t.priority, status: t.status,
      assigned_employee_id: t.assigned_employee_id ?? 0,
      work_notes: t.work_notes ?? "", resolution_notes: t.resolution_notes ?? "",
      raised_by: t.raised_by,
    });
    setDerivedCustomer(t.customer_name ?? "");
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.machine_id) { toast.error("Machine is required"); return; }
    if (!form.title.trim()) { toast.error("Title is required"); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        machine_id: form.machine_id,
        title: form.title,
        description: form.description,
        priority: form.priority,
        raised_by: form.raised_by,
      };
      if (editing) {
        body.status = form.status;
        body.work_notes = form.work_notes;
        body.resolution_notes = form.resolution_notes;
        body.assigned_employee_id = form.assigned_employee_id || null;
      }
      if (editing) { await ticketsApi.update(editing.id, body); toast.success("Ticket updated"); }
      else         { await ticketsApi.create(body);              toast.success("Ticket created"); }
      setFormOpen(false);
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const filtered = search ? items.filter(t =>
    t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.customer_name ?? "").toLowerCase().includes(search.toLowerCase())
  ) : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Tickets</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Ticket</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <TicketIcon className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">All Tickets ({filtered.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Ticket #","Title","Machine","Customer","Priority","Status","Assigned To","Date",""].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                  ))}</tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">No tickets found</td></tr>
                )}
                {!loading && filtered.map(t => (
                  <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-card-foreground">{t.ticket_number}</td>
                    <td className="py-3 px-4 text-card-foreground max-w-[180px] truncate">{t.title}</td>
                    <td className="py-3 px-4 text-card-foreground">{t.machine_code ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{t.customer_name ?? "—"}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", priorityStyles[t.priority] ?? "bg-muted text-muted-foreground")}>{t.priority}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", statusStyles[t.status] ?? "bg-muted text-muted-foreground")}>{t.status.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="py-3 px-4 text-card-foreground">{t.employee_name ?? "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-2xl" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit Ticket — ${editing.ticket_number}` : "New Ticket"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Machine *</Label>
                <Select value={form.machine_id ? String(form.machine_id) : ""} onValueChange={v => handleMachineChange(parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder="Select machine" /></SelectTrigger>
                  <SelectContent>
                    {machines.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.machine_id} — {m.model} ({m.location_name})</SelectItem>)}
                  </SelectContent>
                </Select>
                {derivedCustomer && <p className="text-xs text-muted-foreground mt-1">Customer: <span className="font-medium text-card-foreground">{derivedCustomer}</span></p>}
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Brief description of issue" />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Full details of the problem" />
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => set("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editing && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5 col-span-2">
                <Label>Assign To</Label>
                <Select value={form.assigned_employee_id ? String(form.assigned_employee_id) : "none"} onValueChange={v => set("assigned_employee_id", v === "none" ? 0 : parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {editing && <>
                <div className="space-y-1.5 col-span-2">
                  <Label>Work Notes</Label>
                  <Textarea value={form.work_notes} onChange={e => set("work_notes", e.target.value)} rows={2} placeholder="Notes from field visit" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Resolution Notes</Label>
                  <Textarea value={form.resolution_notes} onChange={e => set("resolution_notes", e.target.value)} rows={2} placeholder="How was the issue resolved?" />
                </div>
              </>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
