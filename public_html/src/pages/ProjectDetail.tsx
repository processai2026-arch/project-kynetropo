import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { opsProjectsApi } from "@/lib/api/ops";
import type { OpsProject } from "@/types/ops";
import { ArrowLeft, Pencil, Check, ChevronRight } from "lucide-react";
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

type ProjectDetailData = OpsProject & {
  stage_history: any[];
  bugs: any[];
  meetings: any[];
  payments: any[];
  activity_log: any[];
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData]           = useState<ProjectDetailData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<"bugs"|"meetings"|"payments"|"log">("bugs");
  const [editing, setEditing]     = useState(false);
  const [form, setForm]           = useState<Partial<OpsProject>>({});
  const [saving, setSaving]       = useState(false);
  // Stage advance
  const [stageTarget, setStageTarget]   = useState<string | null>(null);
  const [stageNote, setStageNote]       = useState("");
  const [advancingStage, setAdvancingStage] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await opsProjectsApi.get(Number(id));
      const d = (res as any).data as ProjectDetailData;
      setData(d);
      setForm({
        name: d.name, owner: d.owner, health: d.health, priority: d.priority,
        stage: d.stage, current_work: d.current_work ?? "", next_action: d.next_action ?? "",
        founder_note: d.founder_note ?? "", blocker: d.blocker ?? "",
        deadline: d.deadline ?? "", quoted: d.quoted,
        next_deadline: d.next_deadline ?? "",
        next_collection_trigger: d.next_collection_trigger ?? "",
        collection_target_date: d.collection_target_date ?? "",
      });
    } catch { toast.error("Failed to load project"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await opsProjectsApi.update(data.id, form);
      toast.success("Project updated");
      setEditing(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally       { setSaving(false); }
  };

  const handleAdvanceStage = async () => {
    if (!data || !stageTarget) return;
    setAdvancingStage(true);
    try {
      await opsProjectsApi.update(data.id, { stage: stageTarget });
      toast.success(`Stage moved to "${stageTarget}"`);
      setStageTarget(null);
      setStageNote("");
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally       { setAdvancingStage(false); }
  };

  const set = (k: keyof OpsProject, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
  if (!data) return <div className="p-8 text-muted-foreground">Project not found</div>;

  const currentStageIdx = PROJECT_STAGES.indexOf(data.stage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
          <p className="text-sm text-muted-foreground">
            <Link to={`/clients/${data.client_id}`} className="hover:underline text-primary">{data.client_name}</Link>
            {" · "}{data.owner || "—"}{data.deadline ? ` · Deadline: ${data.deadline}` : ""}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge className={cn("border capitalize", healthStyles[data.health])}>{data.health}</Badge>
          <Button size="sm" variant={editing ? "default" : "outline"} onClick={editing ? handleSave : () => setEditing(true)} disabled={saving}>
            {editing ? (saving ? "Saving…" : <><Check className="h-3.5 w-3.5 mr-1" />Save</>) : <><Pencil className="h-3.5 w-3.5 mr-1" />Edit</>}
          </Button>
          {editing && <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>}
        </div>
      </div>

      {/* Stage Pipeline */}
      <div className="bg-card rounded-xl border shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-card-foreground">Stage</h2>
          <span className="text-xs text-muted-foreground">Click any stage to move to it</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROJECT_STAGES.map((stage, idx) => {
            const done    = idx < currentStageIdx;
            const current = idx === currentStageIdx;
            const future  = idx > currentStageIdx;
            return (
              <button
                key={stage}
                onClick={() => { if (!current) { setStageTarget(stage); setStageNote(""); } }}
                title={current ? "Current stage" : `Move to "${stage}"`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  done    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 cursor-pointer" :
                  current ? "bg-primary text-primary-foreground border-primary cursor-default ring-2 ring-primary/30" :
                            "bg-muted/40 text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/40 cursor-pointer",
                )}>
                {done && <Check className="h-3 w-3" />}
                {future && <ChevronRight className="h-3 w-3 opacity-50" />}
                {stage}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Work fields */}
        <div className="lg:col-span-2 space-y-4">
          {/* Current work + next action */}
          <div className="bg-card rounded-xl border shadow-sm p-4 space-y-4">
            <h2 className="text-base font-semibold text-card-foreground">Current Status</h2>
            <div className="space-y-1.5">
              <Label>Current Work / Situation</Label>
              {editing
                ? <Textarea value={form.current_work ?? ""} onChange={e => set("current_work", e.target.value)} rows={3} />
                : <p className="text-sm text-card-foreground whitespace-pre-wrap">{data.current_work || <span className="text-muted-foreground">Not set</span>}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Next Action</Label>
              {editing
                ? <Textarea value={form.next_action ?? ""} onChange={e => set("next_action", e.target.value)} rows={2} />
                : <p className="text-sm text-card-foreground whitespace-pre-wrap">{data.next_action || <span className="text-muted-foreground">Not set</span>}</p>}
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label>Next Deadline</Label>
                <Input type="date" value={form.next_deadline ?? ""} onChange={e => set("next_deadline", e.target.value)} />
              </div>
            )}
            {data.founder_note && !editing && (
              <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                <strong>Founder Note:</strong> {data.founder_note}
              </div>
            )}
            {editing && (
              <div className="space-y-1.5">
                <Label>Founder Note (private)</Label>
                <Textarea value={form.founder_note ?? ""} onChange={e => set("founder_note", e.target.value)} rows={2} />
              </div>
            )}
            {(data.blocker || editing) && (
              <div className="space-y-1.5">
                <Label>Blocker</Label>
                {editing
                  ? <Textarea value={form.blocker ?? ""} onChange={e => set("blocker", e.target.value)} rows={2} placeholder="Any blocker preventing progress" />
                  : data.blocker && <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">⚠ {data.blocker}</div>}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
            {(["bugs","meetings","payments","log"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn("flex-1 px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors",
                  activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {tab === "log" ? "Activity" : tab}
                {tab === "bugs" && data.bugs.length > 0 && ` (${data.bugs.length})`}
              </button>
            ))}
          </div>

          {activeTab === "bugs" && (
            <div className="bg-card rounded-xl border shadow-sm p-4 space-y-2">
              {data.bugs.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-4">No bugs</p>
                : data.bugs.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                    <Badge variant="outline" className="text-xs shrink-0 capitalize">{b.priority.replace("_"," ")}</Badge>
                    <span className="flex-1 text-card-foreground truncate">{b.description}</span>
                    <Badge variant="outline" className="text-xs shrink-0 capitalize">{b.status}</Badge>
                  </div>
                ))}
              <Link to={`/bugs?project_id=${data.id}`} className="text-xs text-primary hover:underline block mt-2">View full tracker →</Link>
            </div>
          )}

          {activeTab === "meetings" && (
            <div className="bg-card rounded-xl border shadow-sm p-4 space-y-2">
              {data.meetings.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-4">No meetings</p>
                : data.meetings.map((m: any) => (
                  <div key={m.id} className="py-2 border-b last:border-0 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-card-foreground">{new Date(m.date).toLocaleDateString("en-IN")}</span>
                      <Badge variant="outline" className="text-xs capitalize">{m.type.replace("_"," ")}</Badge>
                    </div>
                    {m.outcome && <p className="text-muted-foreground text-xs mt-1">{m.outcome}</p>}
                  </div>
                ))}
            </div>
          )}

          {activeTab === "payments" && (
            <div className="bg-card rounded-xl border shadow-sm p-4 space-y-2">
              {data.payments.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-4">No payments</p>
                : data.payments.map((p: any) => (
                  <div key={p.id} className="flex justify-between py-2 border-b last:border-0 text-sm">
                    <span className="text-card-foreground capitalize">{p.type} · {p.mode.replace("_"," ")}</span>
                    <div className="text-right">
                      <div className="text-emerald-700 font-medium">₹{Number(p.amount).toLocaleString("en-IN")}</div>
                      <div className="text-xs text-muted-foreground">{p.payment_date}</div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {activeTab === "log" && (
            <div className="bg-card rounded-xl border shadow-sm p-4 space-y-2">
              {data.activity_log.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-4">No activity</p>
                : data.activity_log.map((a: any) => (
                  <div key={a.id} className="py-2 border-b last:border-0 text-sm">
                    <p className="text-card-foreground">{a.description}</p>
                    <p className="text-xs text-muted-foreground">{a.done_by} · {new Date(a.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Right: Financial Summary */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Financial Summary</h3>
            <div className="space-y-2 text-sm">
              {editing ? <>
                <div className="space-y-1.5">
                  <Label>Quoted (₹)</Label>
                  <Input type="number" value={form.quoted ?? ""} onChange={e => set("quoted", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Health</Label>
                  <Select value={form.health ?? "green"} onValueChange={v => set("health", v)}>
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
                  <Select value={form.priority ?? "medium"} onValueChange={v => set("priority", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["low","medium","high","critical"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Next Collection Trigger</Label>
                  <Input value={form.next_collection_trigger ?? ""} onChange={e => set("next_collection_trigger", e.target.value)} placeholder="e.g. After delivery" />
                </div>
                <div className="space-y-1.5">
                  <Label>Collection Target Date</Label>
                  <Input type="date" value={form.collection_target_date ?? ""} onChange={e => set("collection_target_date", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Deadline</Label>
                  <Input type="date" value={form.deadline ?? ""} onChange={e => set("deadline", e.target.value)} />
                </div>
              </> : <>
                {[
                  ["Quoted", `₹${Number(data.quoted).toLocaleString("en-IN")}`],
                  ["Received", `₹${Number(data.received).toLocaleString("en-IN")}`],
                  ["Balance", `₹${Number(data.balance).toLocaleString("en-IN")}`],
                  ["Payment Status", data.payment_status],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn("text-card-foreground capitalize font-medium", label === "Balance" && "text-red-600")}>{val}</span>
                  </div>
                ))}
                {data.next_collection_trigger && (
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    <strong>Next trigger:</strong> {data.next_collection_trigger}
                    {data.collection_target_date && ` by ${data.collection_target_date}`}
                  </div>
                )}
              </>}
            </div>
          </div>
        </div>
      </div>

      {/* Stage Advance Dialog */}
      <Dialog open={!!stageTarget} onOpenChange={v => { if (!advancingStage && !v) setStageTarget(null); }}>
        <DialogContent className="max-w-sm" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Move to "{stageTarget}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium text-xs">{data?.stage}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
              <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium text-xs">{stageTarget}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                rows={3}
                placeholder="What happened, decisions made, reason for moving…"
                value={stageNote}
                onChange={e => setStageNote(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStageTarget(null)} disabled={advancingStage}>Cancel</Button>
              <Button onClick={handleAdvanceStage} disabled={advancingStage}>
                {advancingStage ? "Moving…" : "Confirm Move"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
