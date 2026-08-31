import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { opsProjectsApi, opsClientsApi } from "@/lib/api/ops";
import type { OpsProject, OpsClient } from "@/types/ops";
import { FolderKanban, Plus, Eye, Search } from "lucide-react";
import { toast } from "sonner";

const PROJECT_STAGES = [
  "Lead","Onboarding","Requirements","Scope Freeze","Development",
  "Internal QA","Client UAT","Bug Fixing","Delivered","Closed",
];

const healthStyles: Record<string, string> = {
  green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-600 border-amber-200",
  red:    "bg-red-50 text-red-600 border-red-200",
};
const priorityStyles: Record<string, string> = {
  low:      "bg-gray-100 text-gray-500 border-gray-200",
  medium:   "bg-blue-50 text-blue-600 border-blue-200",
  high:     "bg-amber-50 text-amber-600 border-amber-200",
  critical: "bg-red-50 text-red-600 border-red-200",
};

const EMPTY_PROJ = { name: "", client_id: 0, owner: "", quoted: 0, deadline: "", priority: "medium", health: "green", start_date: "" };

export default function Projects() {
  const [items, setItems]           = useState<OpsProject[]>([]);
  const [clients, setClients]       = useState<OpsClient[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [stageFilter, setStageFilter]   = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [formOpen, setFormOpen]     = useState(false);
  const [editing, setEditing]       = useState<OpsProject | null>(null);
  const [form, setForm]             = useState(EMPTY_PROJ);
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (stageFilter !== "all")    params.stage    = stageFilter;
      if (healthFilter !== "all")   params.health   = healthFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      if (search)                   params.search   = search;
      const res = await opsProjectsApi.list(params);
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load projects"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [stageFilter, healthFilter, priorityFilter]);
  useEffect(() => {
    opsClientsApi.list().then(r => setClients((r as any).data ?? [])).catch(() => {});
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY_PROJ); setFormOpen(true); };
  const openEdit   = (p: OpsProject) => {
    setEditing(p);
    setForm({ name: p.name, client_id: p.client_id, owner: p.owner, quoted: p.quoted,
              deadline: p.deadline ?? "", priority: p.priority, health: p.health, start_date: p.start_date ?? "" });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())   { toast.error("Name required"); return; }
    if (!form.client_id)     { toast.error("Client required"); return; }
    setSaving(true);
    try {
      if (editing) { await opsProjectsApi.update(editing.id, form); toast.success("Project updated"); }
      else         { await opsProjectsApi.create(form);              toast.success("Project created"); }
      setFormOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally       { setSaving(false); }
  };

  const filtered = search
    ? items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.client_name ?? "").toLowerCase().includes(search.toLowerCase()))
    : items;

  const red    = filtered.filter(p => p.health === "red").length;
  const yellow = filtered.filter(p => p.health === "yellow").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Project</Button>
      </div>

      {/* Health summary */}
      {!loading && (red > 0 || yellow > 0) && (
        <div className="flex gap-3">
          {red > 0 && <Badge className="bg-red-50 text-red-600 border-red-200 border">{red} critical</Badge>}
          {yellow > 0 && <Badge className="bg-amber-50 text-amber-600 border-amber-200 border">{yellow} at risk</Badge>}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search project or client…" className="pl-9" value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All stages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {PROJECT_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={healthFilter} onValueChange={setHealthFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Health" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            <SelectItem value="red">Red</SelectItem>
            <SelectItem value="yellow">Yellow</SelectItem>
            <SelectItem value="green">Green</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">All Projects ({filtered.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Project","Client","Stage","Owner","Deadline","Health","Priority","Amount","Balance",""].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 10 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-6 py-8 text-center text-muted-foreground text-sm">No projects found</td></tr>
                )}
                {!loading && filtered.map(p => (
                  <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-card-foreground">{p.name}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.client_name ?? "—"}</td>
                    <td className="py-3 px-4 text-xs text-card-foreground">{p.stage}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.owner || "—"}</td>
                    <td className="py-3 px-4 text-xs text-card-foreground">{p.deadline ?? "—"}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", healthStyles[p.health])}>{p.health}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", priorityStyles[p.priority])}>{p.priority}</Badge>
                    </td>
                    <td className="py-3 px-4 text-card-foreground">₹{Number(p.quoted).toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 font-medium text-red-600">₹{Number(p.balance).toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Search className="h-4 w-4" /></Button>
                      <Link to={`/projects/${p.id}`}><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></Link>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Project Name *</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Cable TV CRM Phase 2" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Client *</Label>
                <Select value={String(form.client_id || "")} onValueChange={v => set("client_id", Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Owner</Label>
                <Input value={form.owner} onChange={e => set("owner", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Quoted Amount (₹)</Label>
                <Input type="number" value={form.quoted || ""} onChange={e => set("quoted", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <Input type="date" value={form.deadline} onChange={e => set("deadline", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Health</Label>
                <Select value={form.health} onValueChange={v => set("health", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="yellow">Yellow</SelectItem>
                    <SelectItem value="red">Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => set("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","critical"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
