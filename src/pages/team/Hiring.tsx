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
import { opsHiringApi } from "@/lib/api/ops";
import type { OpsHiringCandidate } from "@/types/ops";
import { UserCog, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const decisionStyles: Record<string, string> = {
  pending:  "bg-amber-50 text-amber-600 border-amber-200",
  selected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
};

const EMPTY: Partial<OpsHiringCandidate> = {
  name: "", email: "", phone: "", assignment_sent: "", assignment_due: "",
  submitted: 0, workflow_bugs: 0, critical_bugs: 0, reporting_quality: 0,
  reasoning_quality: 0, score: 0, decision: "pending", rejection_reason: "", start_date: "", notes: "",
};

export default function Hiring() {
  const [items, setItems]       = useState<OpsHiringCandidate[]>([]);
  const [loading, setLoading]   = useState(true);
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<OpsHiringCandidate | null>(null);
  const [form, setForm]         = useState<Partial<OpsHiringCandidate>>(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (decisionFilter !== "all") params.decision = decisionFilter;
      const res = await opsHiringApi.list(params);
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load candidates"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [decisionFilter]);

  const set = (k: keyof OpsHiringCandidate, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit   = (c: OpsHiringCandidate) => { setEditing(c); setForm({ ...c }); setFormOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      if (editing) {
        await opsHiringApi.update(editing.id, form);
        if (form.decision === "selected" && editing.decision !== "selected") {
          toast.success("Candidate selected — employee record created automatically");
        } else {
          toast.success("Candidate updated");
        }
      } else {
        await opsHiringApi.create(form);
        toast.success("Candidate added");
      }
      setFormOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally       { setSaving(false); }
  };

  const counts = {
    pending:  items.filter(c => c.decision === "pending").length,
    selected: items.filter(c => c.decision === "selected").length,
    rejected: items.filter(c => c.decision === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Hiring</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Candidate</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Badge className="bg-amber-50 text-amber-600 border border-amber-200">{counts.pending} pending</Badge>
        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">{counts.selected} selected</Badge>
        <Badge className="bg-red-50 text-red-600 border border-red-200">{counts.rejected} rejected</Badge>
      </div>

      <div className="flex gap-3">
        <Select value={decisionFilter} onValueChange={setDecisionFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All decisions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="selected">Selected</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <UserCog className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">Candidates ({items.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Name","Assignment Sent","Due","Submitted","WF Bugs","Critical","Reporting (1-5)","Score/10","Decision","Start Date",""].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 11 }).map((_, j) => <td key={j} className="py-3 px-3"><Skeleton className="h-4 w-14" /></td>)}</tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={11} className="px-6 py-8 text-center text-muted-foreground text-sm">No candidates</td></tr>
                )}
                {!loading && items.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 font-medium text-card-foreground">{c.name}</td>
                    <td className="py-3 px-3 text-card-foreground">{c.assignment_sent ?? "—"}</td>
                    <td className="py-3 px-3 text-card-foreground">{c.assignment_due ?? "—"}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={cn("text-xs font-medium", c.submitted ? "text-emerald-700" : "text-muted-foreground")}>{c.submitted ? "Yes" : "No"}</span>
                    </td>
                    <td className="py-3 px-3 text-center text-card-foreground">{c.workflow_bugs}</td>
                    <td className="py-3 px-3 text-center font-medium text-red-600">{c.critical_bugs}</td>
                    <td className="py-3 px-3 text-center text-card-foreground">{c.reporting_quality}/5</td>
                    <td className="py-3 px-3 text-center font-medium text-card-foreground">{c.score}</td>
                    <td className="py-3 px-3">
                      <Badge className={cn("border capitalize", decisionStyles[c.decision])}>{c.decision}</Badge>
                    </td>
                    <td className="py-3 px-3 text-card-foreground">{c.start_date ?? "—"}</td>
                    <td className="py-3 px-3">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Candidate" : "Add Candidate"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Name *</Label>
                <Input value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Assignment Sent</Label>
                <Input type="date" value={form.assignment_sent ?? ""} onChange={e => set("assignment_sent", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Assignment Due</Label>
                <Input type="date" value={form.assignment_due ?? ""} onChange={e => set("assignment_due", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Submitted?</Label>
                <Select value={String(form.submitted ?? 0)} onValueChange={v => set("submitted", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No</SelectItem>
                    <SelectItem value="1">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Score (/10)</Label>
                <Input type="number" min="0" max="10" step="0.5" value={form.score ?? ""} onChange={e => set("score", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Workflow Bugs Found</Label>
                <Input type="number" min="0" value={form.workflow_bugs ?? ""} onChange={e => set("workflow_bugs", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Critical Bugs Found</Label>
                <Input type="number" min="0" value={form.critical_bugs ?? ""} onChange={e => set("critical_bugs", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Reporting Quality (1-5)</Label>
                <Input type="number" min="1" max="5" value={form.reporting_quality ?? ""} onChange={e => set("reporting_quality", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Reasoning Quality (1-5)</Label>
                <Input type="number" min="1" max="5" value={form.reasoning_quality ?? ""} onChange={e => set("reasoning_quality", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Decision</Label>
                <Select value={form.decision ?? "pending"} onValueChange={v => set("decision", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="selected">Selected</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Start Date (if selected)</Label>
                <Input type="date" value={form.start_date ?? ""} onChange={e => set("start_date", e.target.value)} />
              </div>
              {form.decision === "rejected" && (
                <div className="space-y-1.5 col-span-2">
                  <Label>Rejection Reason</Label>
                  <Textarea value={form.rejection_reason ?? ""} onChange={e => set("rejection_reason", e.target.value)} rows={2} placeholder="Why was this candidate rejected?" />
                </div>
              )}
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add Candidate"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
