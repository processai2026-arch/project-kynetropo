import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { opsClientsApi, opsProjectsApi, opsFinanceApi } from "@/lib/api/ops";
import type { OpsClientDetail, OpsProject } from "@/types/ops";
import {
  ArrowLeft, Plus, Check, ChevronRight, IndianRupee,
  Bug, CalendarDays, FileText, Pencil,
} from "lucide-react";
import { toast } from "sonner";

const CLIENT_STAGES = [
  "First Meetup","Onboarding","Requirements","Scope Freeze",
  "Advance Paid","Development","QA","Delivery","Full Payment","Closed",
];

const healthStyles: Record<string, string> = {
  green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-600 border-amber-200",
  red:    "bg-red-50 text-red-600 border-red-200",
};

const priorityStyles: Record<string, string> = {
  low: "bg-gray-100 text-gray-500", medium: "bg-blue-50 text-blue-600",
  high: "bg-amber-50 text-amber-600", critical: "bg-red-50 text-red-600",
};

const actionIcons: Record<string, React.ReactNode> = {
  payment_received:  <IndianRupee className="h-3.5 w-3.5" />,
  meeting_scheduled: <CalendarDays className="h-3.5 w-3.5" />,
  meeting_outcome:   <CalendarDays className="h-3.5 w-3.5" />,
  bug_added:         <Bug className="h-3.5 w-3.5" />,
  stage_changed:     <ChevronRight className="h-3.5 w-3.5" />,
  created:           <Plus className="h-3.5 w-3.5" />,
};

type Tab = "overview" | "timeline" | "payments" | "meetings" | "bugs" | "checklist";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData]           = useState<OpsClientDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Stage advance
  const [stageTarget, setStageTarget]   = useState<string | null>(null);
  const [stageNote, setStageNote]       = useState("");
  const [advancing, setAdvancing]       = useState(false);

  // Project edit
  const [editingProject, setEditingProject] = useState(false);
  const [projForm, setProjForm]             = useState<Partial<OpsProject>>({});
  const [savingProject, setSavingProject]   = useState(false);

  // Add payment
  const [payOpen, setPayOpen]   = useState(false);
  const [payForm, setPayForm]   = useState({ amount: 0, type: "advance", mode: "bank_transfer", reference: "", payment_date: "", notes: "" });
  const [paying, setPaying]     = useState(false);

  // New project
  const [projectOpen, setProjectOpen] = useState(false);
  const [newProjForm, setNewProjForm] = useState({ name: "", owner: "", quoted: 0, deadline: "", priority: "medium" });
  const [creatingProj, setCreatingProj] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await opsClientsApi.get(Number(id));
      const d = (res as any).data as OpsClientDetail;
      setData(d);
      if (d.project) {
        setProjForm({
          name: d.project.name, owner: d.project.owner, health: d.project.health,
          priority: d.project.priority, current_work: d.project.current_work ?? "",
          next_action: d.project.next_action ?? "", founder_note: d.project.founder_note ?? "",
          blocker: d.project.blocker ?? "", deadline: d.project.deadline ?? "",
          quoted: d.project.quoted, next_collection_trigger: d.project.next_collection_trigger ?? "",
          collection_target_date: d.project.collection_target_date ?? "",
        });
      }
    } catch { toast.error("Failed to load client"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const currentStageIdx = data ? CLIENT_STAGES.indexOf(data.stage) : -1;

  const handleAdvanceStage = async () => {
    if (!stageTarget || !data) return;
    setAdvancing(true);
    try {
      await opsClientsApi.advanceStage(data.id, stageTarget, "Founder", stageNote);
      toast.success(`Moved to "${stageTarget}"`);
      setStageTarget(null); setStageNote(""); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally       { setAdvancing(false); }
  };

  const handleSaveProject = async () => {
    if (!data?.project) return;
    setSavingProject(true);
    try {
      await opsProjectsApi.update(data.project.id, projForm);
      toast.success("Project updated"); setEditingProject(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally       { setSavingProject(false); }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.project) { toast.error("No project linked"); return; }
    if (payForm.amount <= 0) { toast.error("Amount required"); return; }
    setPaying(true);
    try {
      await opsFinanceApi.addPayment({
        client_id: data.id, project_id: data.project.id,
        amount: payForm.amount, type: payForm.type as any, mode: payForm.mode as any,
        reference: payForm.reference,
        payment_date: payForm.payment_date || new Date().toISOString().split("T")[0],
        notes: payForm.notes,
      });
      toast.success("Payment recorded"); setPayOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally       { setPaying(false); }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjForm.name.trim() || !data) return;
    setCreatingProj(true);
    try {
      await opsProjectsApi.create({ ...newProjForm, client_id: data.id });
      toast.success("Project created"); setProjectOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally       { setCreatingProj(false); }
  };

  const handleChecklistToggle = async (itemId: number, isDone: boolean) => {
    if (!data) return;
    try { await opsClientsApi.checklistUpdate(data.id, itemId, isDone); load(); }
    catch { toast.error("Failed"); }
  };

  const set = (k: string, v: unknown) => setProjForm(f => ({ ...f, [k]: v }));

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" /><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" />
    </div>
  );
  if (!data) return <div className="p-8 text-muted-foreground">Client not found</div>;

  const p = data.project;
  const totalPaid = (data.payments ?? []).reduce((s, pay) => s + pay.amount, 0);

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview",  label: "Overview" },
    { key: "timeline",  label: "Timeline" },
    { key: "payments",  label: `Payments (${(data.payments ?? []).length})` },
    { key: "meetings",  label: `Meetings (${(data.meetings ?? []).length})` },
    { key: "bugs",      label: `Bugs (${(data.bugs ?? []).length})` },
    { key: "checklist", label: "Checklist" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clients")} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
          <p className="text-sm text-muted-foreground">{data.phone} · {data.email} · Owner: {data.owner || "—"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={cn("border capitalize", healthStyles[data.health])}>{data.health}</Badge>
          {p && (
            <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Payment
            </Button>
          )}
        </div>
      </div>

      {/* Pipeline Stage */}
      <div className="bg-card rounded-xl border shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-card-foreground">Pipeline Stage</h2>
          <span className="text-xs text-muted-foreground">Click any stage to advance</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {CLIENT_STAGES.map((stage, idx) => {
            const done    = idx < currentStageIdx;
            const current = idx === currentStageIdx;
            return (
              <button key={stage}
                onClick={() => { if (!current) { setStageTarget(stage); setStageNote(""); } }}
                title={current ? "Current stage" : `Move to "${stage}"`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  done    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer" :
                  current ? "bg-primary text-primary-foreground border-primary cursor-default ring-2 ring-primary/30" :
                            "bg-muted/40 text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/40 cursor-pointer",
                )}>
                {done && <Check className="h-3 w-3" />}
                {!done && !current && <ChevronRight className="h-3 w-3 opacity-40" />}
                {stage}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-muted/40 rounded-lg p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn("px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors",
              activeTab === tab.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="lg:col-span-2">

          {/* OVERVIEW — project work fields */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {!p ? (
                <div className="bg-card rounded-xl border shadow-sm p-6 text-center">
                  <p className="text-muted-foreground text-sm mb-3">No project linked yet</p>
                  <Button onClick={() => setProjectOpen(true)}><Plus className="h-4 w-4 mr-2" />Create Project</Button>
                </div>
              ) : (
                <div className="bg-card rounded-xl border shadow-sm p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-card-foreground">{p.name}</h2>
                    <div className="flex gap-2">
                      {editingProject
                        ? <>
                            <Button size="sm" onClick={handleSaveProject} disabled={savingProject}>
                              <Check className="h-3.5 w-3.5 mr-1" />{savingProject ? "Saving…" : "Save"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingProject(false)} disabled={savingProject}>Cancel</Button>
                          </>
                        : <Button size="sm" variant="outline" onClick={() => setEditingProject(true)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                          </Button>
                      }
                    </div>
                  </div>

                  {/* Current work */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Current Work</Label>
                    {editingProject
                      ? <Textarea value={projForm.current_work ?? ""} onChange={e => set("current_work", e.target.value)} rows={3} />
                      : <p className="text-sm text-card-foreground whitespace-pre-wrap">
                          {p.current_work || <span className="text-muted-foreground">Not set</span>}
                        </p>}
                  </div>

                  {/* Next action */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Next Action</Label>
                    {editingProject
                      ? <Textarea value={projForm.next_action ?? ""} onChange={e => set("next_action", e.target.value)} rows={2} />
                      : <p className="text-sm text-card-foreground whitespace-pre-wrap">
                          {p.next_action || <span className="text-muted-foreground">Not set</span>}
                        </p>}
                  </div>

                  {editingProject && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Next Deadline</Label>
                      <Input type="date" value={(projForm as any).next_deadline ?? ""} onChange={e => set("next_deadline", e.target.value)} />
                    </div>
                  )}

                  {/* Founder note */}
                  {(p.founder_note || editingProject) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Founder Note (private)</Label>
                      {editingProject
                        ? <Textarea value={projForm.founder_note ?? ""} onChange={e => set("founder_note", e.target.value)} rows={2} placeholder="Private note…" />
                        : <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                            <strong>Note:</strong> {p.founder_note}
                          </div>}
                    </div>
                  )}

                  {/* Blocker */}
                  {(p.blocker || editingProject) && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Blocker</Label>
                      {editingProject
                        ? <Textarea value={projForm.blocker ?? ""} onChange={e => set("blocker", e.target.value)} rows={2} placeholder="What's blocking progress?" />
                        : p.blocker && <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">⚠ {p.blocker}</div>}
                    </div>
                  )}

                  {editingProject && (
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                      <div className="space-y-1.5">
                        <Label>Health</Label>
                        <Select value={projForm.health ?? "green"} onValueChange={v => set("health", v)}>
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
                        <Select value={projForm.priority ?? "medium"} onValueChange={v => set("priority", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["low","medium","high","critical"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Quoted (₹)</Label>
                        <Input type="number" value={projForm.quoted ?? ""} onChange={e => set("quoted", Number(e.target.value))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Deadline</Label>
                        <Input type="date" value={projForm.deadline ?? ""} onChange={e => set("deadline", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Next Collection Trigger</Label>
                        <Input value={projForm.next_collection_trigger ?? ""} onChange={e => set("next_collection_trigger", e.target.value)} placeholder="e.g. After delivery" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Collection Target Date</Label>
                        <Input type="date" value={projForm.collection_target_date ?? ""} onChange={e => set("collection_target_date", e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TIMELINE */}
          {activeTab === "timeline" && (
            <div className="bg-card rounded-xl border shadow-sm p-4 space-y-3">
              {(data.timeline ?? []).length === 0
                ? <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
                : (data.timeline ?? []).map(entry => (
                  <div key={entry.id} className="flex gap-3 text-sm">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                      {actionIcons[entry.action] ?? <FileText className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-card-foreground">{entry.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.done_by || "System"} · {new Date(entry.created_at).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* PAYMENTS */}
          {activeTab === "payments" && (
            <div className="bg-card rounded-xl border shadow-sm">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="text-sm font-semibold text-card-foreground">
                  Payments — Total received: ₹{totalPaid.toLocaleString("en-IN")}
                </h3>
                <Button size="sm" onClick={() => setPayOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
              </div>
              <div className="p-4 space-y-0">
                {(data.payments ?? []).length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-4">No payments yet</p>
                  : (data.payments ?? []).map(pay => (
                    <div key={pay.id} className="flex justify-between items-start py-3 border-b last:border-0 text-sm">
                      <div>
                        <span className="font-medium text-card-foreground capitalize">{pay.type}</span>
                        <span className="text-muted-foreground ml-2 capitalize">{pay.mode.replace("_"," ")}</span>
                        {pay.reference && <span className="text-muted-foreground ml-2">· {pay.reference}</span>}
                        {pay.notes && <p className="text-xs text-muted-foreground mt-0.5">{pay.notes}</p>}
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <div className="font-medium text-emerald-700">₹{Number(pay.amount).toLocaleString("en-IN")}</div>
                        <div className="text-xs text-muted-foreground">{pay.payment_date}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* MEETINGS */}
          {activeTab === "meetings" && (
            <div className="bg-card rounded-xl border shadow-sm p-4 space-y-3">
              {(data.meetings ?? []).length === 0
                ? <p className="text-sm text-muted-foreground text-center py-4">No meetings yet</p>
                : (data.meetings ?? []).map(m => (
                  <div key={m.id} className="border rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-card-foreground">
                        {new Date(m.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}
                        {" "}{new Date(m.date).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">{m.type.replace("_"," ")}</Badge>
                    </div>
                    {m.agenda   && <p className="text-muted-foreground text-xs">Agenda: {m.agenda}</p>}
                    {m.outcome  && <p className="text-card-foreground">Outcome: {m.outcome}</p>}
                    {m.next_action && <p className="text-xs text-primary">Next: {m.next_action}</p>}
                    {m.next_followup && <p className="text-xs text-amber-600">Follow-up: {m.next_followup}</p>}
                  </div>
                ))}
              <Link to="/meetings" className="text-xs text-primary hover:underline block mt-1">Schedule new meeting →</Link>
            </div>
          )}

          {/* BUGS */}
          {activeTab === "bugs" && (
            <div className="bg-card rounded-xl border shadow-sm p-4 space-y-2">
              {(data.bugs ?? []).length === 0
                ? <p className="text-sm text-muted-foreground text-center py-4">No open bugs</p>
                : (data.bugs ?? []).map(b => (
                  <Link key={b.id} to={`/bugs/${b.id}`}
                    className="flex items-center gap-3 py-2 border-b last:border-0 text-sm hover:bg-muted/30 rounded px-1 transition-colors">
                    <Badge variant="outline" className="text-xs capitalize shrink-0">{b.priority.replace("_"," ")}</Badge>
                    <span className="text-card-foreground flex-1 truncate">{b.description}</span>
                    <Badge variant="outline" className="text-xs capitalize shrink-0">{b.status.replace("_"," ")}</Badge>
                  </Link>
                ))}
              <Link to={`/bugs?project_id=${p?.id}`} className="text-xs text-primary hover:underline block mt-1">View full bug tracker →</Link>
            </div>
          )}

          {/* CHECKLIST */}
          {activeTab === "checklist" && (
            <div className="bg-card rounded-xl border shadow-sm p-4 space-y-0">
              {(data.checklist ?? []).map(item => (
                <div key={item.id} className="flex items-center gap-3 py-3 border-b last:border-0">
                  <input type="checkbox" checked={!!item.is_done}
                    onChange={e => handleChecklistToggle(item.id, e.target.checked)}
                    className="h-4 w-4 accent-primary cursor-pointer shrink-0" />
                  <span className={cn("text-sm flex-1", item.is_done ? "line-through text-muted-foreground" : "text-card-foreground")}>
                    {item.item_name}
                  </span>
                  {item.completed_date && <span className="text-xs text-muted-foreground shrink-0">{item.completed_date}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar — always visible */}
        <div className="space-y-4">
          {/* Financial summary */}
          {p && (
            <div className="bg-card rounded-xl border shadow-sm p-4">
              <h3 className="text-sm font-semibold text-card-foreground mb-3">Financial Summary</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Quoted",   `₹${Number(p.quoted).toLocaleString("en-IN")}`,   ""],
                  ["Received", `₹${Number(p.received).toLocaleString("en-IN")}`, "text-emerald-700 font-medium"],
                  ["Balance",  `₹${Number(p.balance).toLocaleString("en-IN")}`,  "text-red-600 font-bold"],
                  ["Status",   p.payment_status,                                  "capitalize"],
                ].map(([label, val, cls]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn("text-card-foreground", cls as string)}>{val}</span>
                  </div>
                ))}
                {p.next_collection_trigger && (
                  <div className="border-t pt-2 text-xs text-muted-foreground">
                    <strong>Next trigger:</strong> {p.next_collection_trigger}
                    {p.collection_target_date && ` by ${p.collection_target_date}`}
                  </div>
                )}
                {p.blocker && (
                  <div className="mt-1 p-2 bg-red-50 rounded text-xs text-red-700">⚠ {p.blocker}</div>
                )}
              </div>
            </div>
          )}

          {/* Client details */}
          <div className="bg-card rounded-xl border shadow-sm p-4 text-sm space-y-2">
            <h3 className="font-semibold text-card-foreground mb-2">Client Info</h3>
            {[
              ["Source",  data.source || "—"],
              ["Owner",   data.owner  || "—"],
              ["Phone",   data.phone  || "—"],
              ["Email",   data.email  || "—"],
              ["Stage",   data.stage],
              ["Health",  data.health],
              ...(p ? [
                ["Deadline",  p.deadline || "—"],
                ["Priority",  p.priority],
              ] : []),
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-2">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="text-card-foreground capitalize text-right truncate">{val as string}</span>
              </div>
            ))}
            {data.notes && <p className="text-muted-foreground text-xs mt-2 pt-2 border-t">{data.notes}</p>}
          </div>
        </div>
      </div>

      {/* Stage Advance Dialog */}
      <Dialog open={!!stageTarget} onOpenChange={v => { if (!advancing && !v) setStageTarget(null); }}>
        <DialogContent className="max-w-sm" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>Move to "{stageTarget}"</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{data.stage}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">{stageTarget}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea rows={3} placeholder="What happened, decisions made…"
                value={stageNote} onChange={e => setStageNote(e.target.value)} autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStageTarget(null)} disabled={advancing}>Cancel</Button>
              <Button onClick={handleAdvanceStage} disabled={advancing}>{advancing ? "Moving…" : "Confirm Move"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={v => { if (!paying) setPayOpen(v); }}>
        <DialogContent className="max-w-md" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>Record Payment — {data.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Amount (₹) *</Label>
                <Input type="number" value={payForm.amount || ""} onChange={e => setPayForm(f => ({ ...f, amount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={payForm.type} onValueChange={v => setPayForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["advance","mid","final","amc","other"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select value={payForm.mode} onValueChange={v => setPayForm(f => ({ ...f, mode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["cash","bank_transfer","upi","cheque"].map(m => <SelectItem key={m} value={m}>{m.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="UTR / cheque no." />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>Cancel</Button>
              <Button type="submit" disabled={paying}>{paying ? "Saving…" : "Record Payment"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={projectOpen} onOpenChange={v => { if (!creatingProj) setProjectOpen(v); }}>
        <DialogContent onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>Create Project for {data.name}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Project Name *</Label>
                <Input value={newProjForm.name} onChange={e => setNewProjForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cable TV CRM Phase 2" />
              </div>
              <div className="space-y-1.5">
                <Label>Owner</Label>
                <Input value={newProjForm.owner} onChange={e => setNewProjForm(f => ({ ...f, owner: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Quoted Amount (₹)</Label>
                <Input type="number" value={newProjForm.quoted || ""} onChange={e => setNewProjForm(f => ({ ...f, quoted: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <Input type="date" value={newProjForm.deadline} onChange={e => setNewProjForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={newProjForm.priority} onValueChange={v => setNewProjForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low","medium","high","critical"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProjectOpen(false)} disabled={creatingProj}>Cancel</Button>
              <Button type="submit" disabled={creatingProj}>{creatingProj ? "Creating…" : "Create Project"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
