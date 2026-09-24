import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { opsBugsApi, opsProjectsApi, opsEmployeesApi } from "@/lib/api/ops";
import type { OpsBug, OpsProject, OpsEmployee } from "@/types/ops";
import { Bug, Plus, Pencil, MessageSquare, Eye } from "lucide-react";
import { toast } from "sonner";

const priorityStyles: Record<string, string> = {
  p0_critical: "bg-red-50 text-red-600 border-red-200",
  p1_high:     "bg-amber-50 text-amber-600 border-amber-200",
  p2_medium:   "bg-blue-50 text-blue-600 border-blue-200",
  p3_low:      "bg-gray-100 text-gray-500 border-gray-200",
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
  project_id: 0, module: "", description: "", type: "bug", priority: "p2_medium",
  reported_by: "", status: "open", target_date: "", steps_to_repro: "",
};

export default function Bugs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bugs, setBugs]         = useState<OpsBug[]>([]);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [employees, setEmployees] = useState<OpsEmployee[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>(searchParams.get("project_id") ?? "");
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
      if (selectedProject) params.project_id = selectedProject;
      if (statusFilter !== "all")   params.status   = statusFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      const res = await opsBugsApi.list(params);
      setBugs((res as any).data ?? []);
    } catch { toast.error("Failed to load bugs"); }
    finally  { setLoading(false); }
  };

  useEffect(() => {
    opsProjectsApi.list().then(r => setProjects((r as any).data ?? [])).catch(() => {});
    opsEmployeesApi.list({ status: "active" }).then(r => setEmployees((r as any).data ?? [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [selectedProject, statusFilter, priorityFilter]);

  const set = (k: keyof OpsBug, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, project_id: selectedProject ? Number(selectedProject) : 0 });
    setFormOpen(true);
  };
  const openEdit = (b: OpsBug) => {
    setEditing(b);
    setForm({ project_id: b.project_id, module: b.module, description: b.description,
              type: b.type, priority: b.priority, reported_by: b.reported_by,
              developer_id: b.developer_id ?? undefined, qa_id: b.qa_id ?? undefined,
              status: b.status, target_date: b.target_date ?? "", steps_to_repro: b.steps_to_repro ?? "" });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id)  { toast.error("Project required"); return; }
    if (!form.description?.trim()) { toast.error("Description required"); return; }
    setSaving(true);
    try {
      if (editing) { await opsBugsApi.update(editing.id, form); toast.success("Bug updated"); }
      else         { await opsBugsApi.create(form);              toast.success("Bug added"); }
      setFormOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally       { setSaving(false); }
  };

  const counts = { open: bugs.filter(b => b.status === "open").length,
                   in_progress: bugs.filter(b => b.status === "in_progress").length,
                   fixed: bugs.filter(b => b.status === "fixed").length };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Bug Tracker</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Bug</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {["open","in_progress","fixed","retest","closed","wont_fix"].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {[["p0_critical","P0 Critical"],["p1_high","P1 High"],["p2_medium","P2 Medium"],["p3_low","P3 Low"]].map(([v,l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary badges */}
      {!loading && (
        <div className="flex gap-2 flex-wrap">
          <Badge className="bg-red-50 text-red-600 border border-red-200">{counts.open} open</Badge>
          <Badge className="bg-amber-50 text-amber-600 border border-amber-200">{counts.in_progress} in progress</Badge>
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">{counts.fixed} fixed</Badge>
        </div>
      )}

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Bug className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">Bugs ({bugs.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["#","Module","Description","Type","Priority","Reported By","Developer","QA","Status","Target",""].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 11 }).map((_, j) => <td key={j} className="py-3 px-3"><Skeleton className="h-4 w-16" /></td>)}
                  </tr>
                ))}
                {!loading && bugs.length === 0 && (
                  <tr><td colSpan={11} className="px-6 py-8 text-center text-muted-foreground text-sm">No bugs found</td></tr>
                )}
                {!loading && bugs.map(b => (
                  <tr key={b.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/bugs/${b.id}`)}>
                    <td className="py-3 px-3 text-muted-foreground text-xs">#{b.id}</td>
                    <td className="py-3 px-3 text-card-foreground">{b.module || "—"}</td>
                    <td className="py-3 px-3 text-card-foreground max-w-[200px] truncate font-medium" title={b.description}>{b.description}</td>
                    <td className="py-3 px-3 text-xs text-card-foreground capitalize">{b.type.replace("_"," ")}</td>
                    <td className="py-3 px-3">
                      <Badge className={cn("border text-xs capitalize", priorityStyles[b.priority] ?? "bg-muted text-muted-foreground")}>
                        {b.priority.replace("_"," ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-card-foreground">{b.reported_by || "—"}</td>
                    <td className="py-3 px-3 text-card-foreground">{b.developer_name || "—"}</td>
                    <td className="py-3 px-3 text-card-foreground">{b.qa_name || "—"}</td>
                    <td className="py-3 px-3">
                      <Badge className={cn("border capitalize text-xs", statusStyles[b.status] ?? "bg-muted text-muted-foreground")}>
                        {b.status.replace("_"," ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-xs text-card-foreground">{b.target_date ?? "—"}</td>
                    <td className="py-3 px-3 flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/bugs/${b.id}`)} title="View detail"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/bugs/${b.id}#comment`)} title="Add comment"><MessageSquare className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Bug Dialog */}
      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-2xl" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editing ? "Edit Bug" : "Add Bug"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Project *</Label>
                <Select value={String(form.project_id || "")} onValueChange={v => set("project_id", Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Module</Label>
                <Input value={form.module ?? ""} onChange={e => set("module", e.target.value)} placeholder="Which module/screen" />
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
              <div className="space-y-1.5 col-span-2">
                <Label>Description *</Label>
                <Textarea value={form.description ?? ""} onChange={e => set("description", e.target.value)} rows={3} placeholder="What is the issue?" />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority ?? "p2_medium"} onValueChange={v => set("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p0_critical">P0 Critical</SelectItem>
                    <SelectItem value="p1_high">P1 High</SelectItem>
                    <SelectItem value="p2_medium">P2 Medium</SelectItem>
                    <SelectItem value="p3_low">P3 Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <div className="space-y-1.5">
                <Label>Reported By</Label>
                <Input value={form.reported_by ?? ""} onChange={e => set("reported_by", e.target.value)} placeholder="Name" />
              </div>
              <div className="space-y-1.5">
                <Label>Target Fix Date</Label>
                <Input type="date" value={form.target_date ?? ""} onChange={e => set("target_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Developer</Label>
                <Select value={String(form.developer_id ?? "")} onValueChange={v => set("developer_id", v ? Number(v) : null)}>
                  <SelectTrigger><SelectValue placeholder="Assign developer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>QA</Label>
                <Select value={String(form.qa_id ?? "")} onValueChange={v => set("qa_id", v ? Number(v) : null)}>
                  <SelectTrigger><SelectValue placeholder="Assign QA" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Steps to Reproduce</Label>
                <Textarea value={form.steps_to_repro ?? ""} onChange={e => set("steps_to_repro", e.target.value)} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add Bug"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
