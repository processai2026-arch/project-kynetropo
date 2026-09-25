import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RecordListPage } from "@/components/RecordListPage";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { opsBugsApi, opsProjectsApi, opsEmployeesApi } from "@/lib/api/ops";
import type { OpsBug, OpsProject, OpsEmployee } from "@/types/ops";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const priorityStyles: Record<string, string> = {
  p0_critical: "bg-red-50 text-red-600 border-red-200",
  p1_high:     "bg-amber-50 text-amber-600 border-amber-200",
  p2_medium:   "bg-blue-50 text-blue-600 border-blue-200",
  p3_low:      "bg-gray-100 text-gray-500 border-gray-200",
};
const priorityLabels: Record<string, string> = {
  p0_critical: "P0 Critical", p1_high: "P1 High",
  p2_medium: "P2 Medium",    p3_low:  "P3 Low",
};
const statusStyles: Record<string, string> = {
  open:        "bg-red-50 text-red-600 border-red-200",
  in_progress: "bg-amber-50 text-amber-600 border-amber-200",
  fixed:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  retest:      "bg-blue-50 text-blue-600 border-blue-200",
  closed:      "bg-gray-100 text-gray-500 border-gray-200",
  wont_fix:    "bg-gray-100 text-gray-400 border-gray-200",
};

const EMPTY: Partial<OpsBug> = {
  description: "", project_id: undefined, module: "", type: "bug",
  priority: "p2_medium", status: "open", reported_by: "", steps_to_repro: "",
  target_date: "", developer_id: undefined,
};

export default function Bugs() {
  const navigate  = useNavigate();
  const [items, setItems]       = useState<OpsBug[]>([]);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [employees, setEmployees] = useState<OpsEmployee[]>([]);
  const [loading, setLoading]   = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<OpsBug | null>(null);
  const [form, setForm]         = useState<Partial<OpsBug>>(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (projectFilter !== "all")  params.project_id = projectFilter;
      if (statusFilter !== "all")   params.status = statusFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      const res = await opsBugsApi.list(params);
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load bugs"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectFilter, statusFilter, priorityFilter]);
  useEffect(() => {
    opsProjectsApi.list().then(r => setProjects((r as any).data ?? [])).catch(() => {});
    opsEmployeesApi.list().then(r => setEmployees((r as any).data ?? [])).catch(() => {});
  }, []);

  const set = (k: keyof OpsBug, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit   = (b: OpsBug) => { setEditing(b); setForm({ ...b }); setFormOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description?.trim()) { toast.error("Description required"); return; }
    if (!form.project_id)          { toast.error("Project required"); return; }
    setSaving(true);
    try {
      if (editing) { await opsBugsApi.update(editing.id, form); toast.success("Bug updated"); }
      else         { await opsBugsApi.create(form);              toast.success("Bug reported"); }
      setFormOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally       { setSaving(false); }
  };

  const counts = {
    open:     items.filter(b => b.status === "open").length,
    progress: items.filter(b => b.status === "in_progress").length,
    retest:   items.filter(b => b.status === "retest").length,
    critical: items.filter(b => b.priority === "p0_critical" && b.status !== "closed" && b.status !== "wont_fix").length,
  };

  return (
    <RecordListPage>
      <PageHeader
        title="Bugs"
        action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Report Bug</Button>}
      />

      <div className="flex gap-2 flex-wrap">
        {counts.critical > 0 && <Badge className="bg-red-50 text-red-600 border border-red-200">{counts.critical} critical</Badge>}
        {counts.open > 0     && <Badge className="bg-amber-50 text-amber-600 border border-amber-200">{counts.open} open</Badge>}
        {counts.progress > 0 && <Badge className="bg-blue-50 text-blue-600 border border-blue-200">{counts.progress} in progress</Badge>}
        {counts.retest > 0   && <Badge className="bg-purple-50 text-purple-600 border border-purple-200">{counts.retest} retest</Badge>}
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["open","in_progress","fixed","retest","closed","wont_fix"].map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {Object.entries(priorityLabels).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Panel title={`Bugs (${items.length})`} flush>
        <div className="overflow-x-auto eco-float-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["#","Description","Project","Module","Priority","Status","Reported By","Assigned To","Target Date",""].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">{Array.from({ length: 10 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={10} className="px-6 py-8 text-center text-muted-foreground text-sm">No bugs found</td></tr>
              )}
              {!loading && items.map(b => (
                <tr
                  key={b.id}
                  className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/bugs/${b.id}`)}
                >
                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground">#{b.id}</td>
                  <td className="py-3 px-4 font-medium text-card-foreground max-w-[240px] truncate">{b.description}</td>
                  <td className="py-3 px-4 text-card-foreground">{b.project_name ?? "—"}</td>
                  <td className="py-3 px-4 text-card-foreground">{b.module || "—"}</td>
                  <td className="py-3 px-4">
                    <Badge className={cn("border text-xs", priorityStyles[b.priority])}>{priorityLabels[b.priority]}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge className={cn("border capitalize text-xs", statusStyles[b.status])}>{b.status.replace("_"," ")}</Badge>
                  </td>
                  <td className="py-3 px-4 text-card-foreground">{b.reported_by || "—"}</td>
                  <td className="py-3 px-4 text-card-foreground">{b.developer_name || "—"}</td>
                  <td className="py-3 px-4 text-card-foreground">{b.target_date || "—"}</td>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-2xl" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editing ? "Edit Bug" : "Report Bug"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Description *</Label>
                <Input value={form.description ?? ""} onChange={e => set("description", e.target.value)} placeholder="What went wrong?" />
              </div>
              <div className="space-y-1.5">
                <Label>Project *</Label>
                <Select value={String(form.project_id ?? "")} onValueChange={v => set("project_id", v ? Number(v) : undefined)}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Module</Label>
                <Input value={form.module ?? ""} onChange={e => set("module", e.target.value)} placeholder="e.g. checkout, auth" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type ?? "bug"} onValueChange={v => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="change_request">Change Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority ?? "p2_medium"} onValueChange={v => set("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityLabels).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {editing && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status ?? "open"} onValueChange={v => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["open","in_progress","fixed","retest","closed","wont_fix"].map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Assign to Developer</Label>
                <Select value={String(form.developer_id ?? "")} onValueChange={v => set("developer_id", v ? Number(v) : undefined)}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reported By</Label>
                <Input value={form.reported_by ?? ""} onChange={e => set("reported_by", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Target Date</Label>
                <Input type="date" value={form.target_date ?? ""} onChange={e => set("target_date", e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Steps to Reproduce</Label>
                <Textarea value={form.steps_to_repro ?? ""} onChange={e => set("steps_to_repro", e.target.value)} rows={3}
                  placeholder={"1. Go to...\n2. Click...\n3. Expected: — Actual: "} className="font-mono text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Report Bug"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </RecordListPage>
  );
}
