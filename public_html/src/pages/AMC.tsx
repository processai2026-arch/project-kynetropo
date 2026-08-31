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
import { opsAmcApi, opsClientsApi, opsProjectsApi } from "@/lib/api/ops";
import type { OpsAmcRecord, OpsClient, OpsProject } from "@/types/ops";
import { RefreshCcw, Plus, Pencil, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  active:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  due:     "bg-amber-50 text-amber-600 border-amber-200",
  overdue: "bg-red-50 text-red-600 border-red-200",
  paid:    "bg-gray-100 text-gray-500 border-gray-200",
};

const EMPTY = { client_id: 0, project_id: 0, amount: 0, start_date: "", renewal_date: "", payment_mode: "", notes: "" };

export default function AMC() {
  const [items, setItems]       = useState<OpsAmcRecord[]>([]);
  const [clients, setClients]   = useState<OpsClient[]>([]);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<OpsAmcRecord | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await opsAmcApi.list(params);
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load AMC records"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);
  useEffect(() => {
    opsClientsApi.list().then(r => setClients((r as any).data ?? [])).catch(() => {});
    opsProjectsApi.list().then(r => setProjects((r as any).data ?? [])).catch(() => {});
  }, []);

  const clientProjects = form.client_id ? projects.filter(p => p.client_id === form.client_id) : projects;
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit   = (a: OpsAmcRecord) => {
    setEditing(a);
    setForm({ client_id: a.client_id, project_id: a.project_id, amount: a.amount,
              start_date: a.start_date, renewal_date: a.renewal_date,
              payment_mode: a.payment_mode ?? "", notes: a.notes ?? "" });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.project_id) { toast.error("Client and project required"); return; }
    if (form.amount <= 0) { toast.error("Amount required"); return; }
    setSaving(true);
    try {
      // Auto-calculate renewal date if only start_date given
      const startDate   = form.start_date || new Date().toISOString().split("T")[0];
      const renewalDate = form.renewal_date || new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1)).toISOString().split("T")[0];
      if (editing) {
        await opsAmcApi.update(editing.id, { ...form, start_date: startDate, renewal_date: renewalDate });
        toast.success("AMC updated");
      } else {
        await opsAmcApi.create({ ...form, start_date: startDate, renewal_date: renewalDate });
        toast.success("AMC record created");
      }
      setFormOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally       { setSaving(false); }
  };

  const handleMarkPaid = async (id: number) => {
    setMarkingId(id);
    try {
      await opsAmcApi.update(id, { status: "paid" } as any);
      toast.success("AMC marked as paid — payment logged automatically");
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally       { setMarkingId(null); }
  };

  const counts = {
    due:     items.filter(a => a.status === "due").length,
    overdue: items.filter(a => a.status === "overdue").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">AMC</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add AMC</Button>
      </div>

      {(counts.overdue > 0 || counts.due > 0) && (
        <div className="flex gap-2">
          {counts.overdue > 0 && <Badge className="bg-red-50 text-red-600 border border-red-200">{counts.overdue} overdue</Badge>}
          {counts.due > 0     && <Badge className="bg-amber-50 text-amber-600 border border-amber-200">{counts.due} due soon</Badge>}
        </div>
      )}

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="due">Due Soon</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <RefreshCcw className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">AMC Records ({items.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Client","Project","Amount","Start Date","Renewal Date","Days Until","Status",""].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 8 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-sm">No AMC records found</td></tr>
                )}
                {!loading && items.map(a => {
                  const daysLeft = a.days_until_renewal;
                  const rowColor = a.status === "overdue" ? "bg-red-50/40" : a.status === "due" ? "bg-amber-50/40" : "";
                  return (
                    <tr key={a.id} className={cn("border-b hover:bg-muted/30 transition-colors", rowColor)}>
                      <td className="py-3 px-4 font-medium text-card-foreground">{a.client_name}</td>
                      <td className="py-3 px-4 text-card-foreground">{a.project_name}</td>
                      <td className="py-3 px-4 font-medium text-card-foreground">₹{Number(a.amount).toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-card-foreground">{a.start_date}</td>
                      <td className="py-3 px-4 text-card-foreground">{a.renewal_date}</td>
                      <td className="py-3 px-4 text-card-foreground">
                        {daysLeft != null
                          ? daysLeft < 0 ? <span className="text-red-600 font-medium">{Math.abs(daysLeft)}d overdue</span>
                          : daysLeft === 0 ? <span className="text-amber-600 font-medium">Today</span>
                          : <span className={daysLeft <= 30 ? "text-amber-600" : ""}>{daysLeft}d</span>
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", statusStyles[a.status] ?? "bg-muted text-muted-foreground")}>{a.status}</Badge>
                      </td>
                      <td className="py-3 px-4 flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                        {a.status !== "paid" && (
                          <Button variant="ghost" size="icon" onClick={() => handleMarkPaid(a.id)} disabled={markingId === a.id} title="Mark Collected">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editing ? "Edit AMC" : "Add AMC Record"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Client *</Label>
                <Select value={String(form.client_id || "")} onValueChange={v => set("client_id", Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Project *</Label>
                <Select value={String(form.project_id || "")} onValueChange={v => set("project_id", Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Select project</SelectItem>
                    {clientProjects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>AMC Amount (₹) *</Label>
                <Input type="number" value={form.amount || ""} onChange={e => set("amount", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Input value={form.payment_mode} onChange={e => set("payment_mode", e.target.value)} placeholder="UPI / Bank transfer" />
              </div>
              <div className="space-y-1.5">
                <Label>Contract Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Renewal Date (auto = start + 1yr)</Label>
                <Input type="date" value={form.renewal_date} onChange={e => set("renewal_date", e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
