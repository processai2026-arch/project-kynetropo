import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  opsMeetingsApi, opsProjectsApi, opsClientsApi, opsBugsApi,
  opsEmployeesApi, opsPitchesApi, opsFinanceApi, opsAiCommandApi,
} from "@/lib/api/ops";
import type { OpsMeeting, OpsProject, OpsClient, OpsBug, OpsEmployee, OpsPitch, OpsPayment, OpsExpense } from "@/types/ops";
import { toast } from "sonner";

interface PendingEdit {
  method: string;
  path: string;
  body: Record<string, unknown>;
  token?: string;
}

interface Props {
  pendingEdit: PendingEdit | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

// ─── Path routing ─────────────────────────────────────────────────────────────

type FormKind =
  | { kind: "meeting"; id: number | null }
  | { kind: "project"; id: number | null }
  | { kind: "client";  id: number | null }
  | { kind: "bug";     id: number | null }
  | { kind: "payment" }
  | { kind: "expense" }
  | { kind: "fallback" };

function classify(method: string, path: string): FormKind {
  const m = method.toUpperCase();
  const p = path.replace(/^\/api/, "");

  const meetingCreate = m === "POST" && /^\/admin\/ops\/meetings$/.test(p);
  const meetingEdit   = m === "PUT"  && /^\/admin\/ops\/meetings\/\d+$/.test(p);
  const projectCreate = m === "POST" && /^\/admin\/ops\/projects$/.test(p);
  const projectEdit   = m === "PUT"  && /^\/admin\/ops\/projects\/\d+$/.test(p);
  const clientCreate  = m === "POST" && /^\/admin\/ops\/clients$/.test(p);
  const clientEdit    = m === "PUT"  && /^\/admin\/ops\/clients\/\d+$/.test(p);
  const bugCreate     = m === "POST" && /^\/admin\/ops\/bugs$/.test(p);
  const bugEdit       = m === "PUT"  && /^\/admin\/ops\/bugs\/\d+$/.test(p);
  const payment       = m === "POST" && /^\/admin\/ops\/finance\/payments$/.test(p);
  const expense       = m === "POST" && /^\/admin\/ops\/finance\/expenses$/.test(p);

  const id = (s: string) => Number(s.split("/").pop()) || null;

  if (meetingCreate) return { kind: "meeting", id: null };
  if (meetingEdit)   return { kind: "meeting", id: id(p) };
  if (projectCreate) return { kind: "project", id: null };
  if (projectEdit)   return { kind: "project", id: id(p) };
  if (clientCreate)  return { kind: "client",  id: null };
  if (clientEdit)    return { kind: "client",  id: id(p) };
  if (bugCreate)     return { kind: "bug",     id: null };
  if (bugEdit)       return { kind: "bug",     id: id(p) };
  if (payment)       return { kind: "payment" };
  if (expense)       return { kind: "expense" };
  return { kind: "fallback" };
}

// ─── AiEditFormManager ────────────────────────────────────────────────────────

export default function AiEditFormManager({ pendingEdit, onClose, onSuccess }: Props) {
  if (!pendingEdit) return null;

  const classified = classify(pendingEdit.method, pendingEdit.path);

  if (classified.kind === "meeting")
    return <MeetingForm id={classified.id} body={pendingEdit.body} onClose={onClose} onSuccess={onSuccess} />;
  if (classified.kind === "project")
    return <ProjectForm id={classified.id} body={pendingEdit.body} onClose={onClose} onSuccess={onSuccess} />;
  if (classified.kind === "client")
    return <ClientForm  id={classified.id} body={pendingEdit.body} onClose={onClose} onSuccess={onSuccess} />;
  if (classified.kind === "bug")
    return <BugForm     id={classified.id} body={pendingEdit.body} onClose={onClose} onSuccess={onSuccess} />;
  if (classified.kind === "payment")
    return <PaymentForm body={pendingEdit.body} onClose={onClose} onSuccess={onSuccess} />;
  if (classified.kind === "expense")
    return <ExpenseForm body={pendingEdit.body} onClose={onClose} onSuccess={onSuccess} />;

  // Fallback — path not mapped to a form
  return <FallbackForm pendingEdit={pendingEdit} onClose={onClose} onSuccess={onSuccess} />;
}

// ─── Shared sub-form props ────────────────────────────────────────────────────

interface SubFormProps {
  id: number | null;
  body: Record<string, unknown>;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

interface SimpleFormProps {
  body: Record<string, unknown>;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

// ─── Meeting Form ─────────────────────────────────────────────────────────────

const MEETING_EMPTY: Partial<OpsMeeting> = {
  client_id: undefined, project_id: undefined, date: "", type: "google_meet",
  link: "", attendees: "", agenda: "", outcome: "", next_action: "", next_followup: "", booked_by: "",
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  google_meet: "Google Meet", in_person: "In-Person",
  phone_call: "Phone Call", whatsapp_call: "WhatsApp",
};

function MeetingForm({ id, body, onClose, onSuccess }: SubFormProps) {
  const [form, setForm]     = useState<Partial<OpsMeeting>>(MEETING_EMPTY);
  const [clients, setClients]   = useState<OpsClient[]>([]);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    opsClientsApi.list().then(r => setClients((r as any).data ?? [])).catch(() => {});
    opsProjectsApi.list().then(r => setProjects((r as any).data ?? [])).catch(() => {});

    if (id) {
      opsMeetingsApi.get(id).then(r => {
        const m = (r as any).data as OpsMeeting;
        setForm({
          ...MEETING_EMPTY,
          client_id:    m.client_id ?? undefined,
          project_id:   m.project_id ?? undefined,
          date:         m.date?.slice(0, 16) ?? "",
          type:         m.type,
          link:         m.link ?? "",
          attendees:    m.attendees ?? "",
          agenda:       m.agenda ?? "",
          outcome:      m.outcome ?? "",
          next_action:  m.next_action ?? "",
          next_followup: m.next_followup ?? "",
          booked_by:    m.booked_by,
          ...body,
        });
      }).catch(() => toast.error("Could not load meeting")).finally(() => setLoading(false));
    } else {
      setForm({ ...MEETING_EMPTY, ...body });
    }
  }, []);

  const set = (k: keyof OpsMeeting, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const clientProjects = form.client_id
    ? projects.filter(p => p.client_id === (form.client_id as number))
    : projects;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { toast.error("Date is required"); return; }
    setSaving(true);
    try {
      if (id) { await opsMeetingsApi.update(id, form); onSuccess("Meeting updated"); }
      else    { await opsMeetingsApi.create(form);     onSuccess("Meeting scheduled"); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!saving && !v) onClose(); }}>
      <DialogContent className="max-w-2xl" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>{id ? "Edit Meeting" : "Schedule Meeting"}</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select value={String(form.client_id ?? "")} onValueChange={v => set("client_id", v ? Number(v) : undefined)}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No client</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={String(form.project_id ?? "")} onValueChange={v => set("project_id", v ? Number(v) : undefined)}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No project</SelectItem>
                    {clientProjects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date & Time *</Label>
                <Input type="datetime-local" value={form.date ?? ""} onChange={e => set("date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type ?? "google_meet"} onValueChange={v => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEETING_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Google Meet Link</Label>
                <Input value={form.link ?? ""} onChange={e => set("link", e.target.value)} placeholder="https://meet.google.com/..." />
              </div>
              <div className="space-y-1.5">
                <Label>Booked By</Label>
                <Input value={form.booked_by ?? ""} onChange={e => set("booked_by", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Next Follow-up Date</Label>
                <Input type="date" value={form.next_followup ?? ""} onChange={e => set("next_followup", e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Agenda</Label>
                <Textarea value={form.agenda ?? ""} onChange={e => set("agenda", e.target.value)} rows={2} placeholder="Topics to discuss" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Outcome (fill after meeting)</Label>
                <Textarea value={form.outcome ?? ""} onChange={e => set("outcome", e.target.value)} rows={2} placeholder="What was decided…" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Next Action</Label>
                <Input value={form.next_action ?? ""} onChange={e => set("next_action", e.target.value)} placeholder="What needs to happen next" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving…</> : id ? "Update" : "Schedule"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Project Form ─────────────────────────────────────────────────────────────

const PROJECT_EMPTY = { name: "", client_id: 0, owner: "", quoted: 0, deadline: "", priority: "medium", health: "green", start_date: "" };

function ProjectForm({ id, body, onClose, onSuccess }: SubFormProps) {
  const [form, setForm]     = useState(PROJECT_EMPTY);
  const [clients, setClients] = useState<OpsClient[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    opsClientsApi.list().then(r => setClients((r as any).data ?? [])).catch(() => {});

    if (id) {
      opsProjectsApi.get(id).then(r => {
        const p = (r as any).data as OpsProject;
        setForm({
          ...PROJECT_EMPTY,
          name:       p.name,
          client_id:  p.client_id,
          owner:      p.owner,
          quoted:     p.quoted,
          deadline:   p.deadline ?? "",
          priority:   p.priority,
          health:     p.health,
          start_date: p.start_date ?? "",
          ...(body as any),
        });
      }).catch(() => toast.error("Could not load project")).finally(() => setLoading(false));
    } else {
      setForm({ ...PROJECT_EMPTY, ...(body as any) });
    }
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())  { toast.error("Name required"); return; }
    if (!form.client_id)    { toast.error("Client required"); return; }
    setSaving(true);
    try {
      if (id) { await opsProjectsApi.update(id, form); onSuccess("Project updated"); }
      else    { await opsProjectsApi.create(form);     onSuccess("Project created"); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!saving && !v) onClose(); }}>
      <DialogContent className="max-w-2xl" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>{id ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
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
                    {["low", "medium", "high", "critical"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving…</> : id ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Client Form ──────────────────────────────────────────────────────────────

const CLIENT_EMPTY = {
  name: "", phone: "", email: "", source: "", source_pitch_id: "" as string | number,
  owner: "", health: "green" as const, notes: "",
};

function ClientForm({ id, body, onClose, onSuccess }: SubFormProps) {
  const [form, setForm]     = useState(CLIENT_EMPTY);
  const [pitches, setPitches] = useState<OpsPitch[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    opsPitchesApi.list().then(r => setPitches((r as any).data ?? [])).catch(() => {});

    if (id) {
      opsClientsApi.get(id).then(r => {
        const c = (r as any).data as OpsClient;
        setForm({
          ...CLIENT_EMPTY,
          name:            c.name,
          phone:           c.phone,
          email:           c.email,
          source:          c.source,
          source_pitch_id: c.source_pitch_id ?? "",
          owner:           c.owner,
          health:          c.health,
          notes:           c.notes ?? "",
          ...(body as any),
        });
      }).catch(() => toast.error("Could not load client")).finally(() => setLoading(false));
    } else {
      setForm({ ...CLIENT_EMPTY, ...(body as any) });
    }
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, source_pitch_id: form.source_pitch_id ? Number(form.source_pitch_id) : null };
      if (id) { await opsClientsApi.update(id, payload); onSuccess("Client updated"); }
      else    { await opsClientsApi.create(payload);     onSuccess("Client added"); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!saving && !v) onClose(); }}>
      <DialogContent className="max-w-2xl" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>{id ? "Edit Client" : "Add Client"}</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Client / Company Name *</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Biomass ERP" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 9876543210" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Owner</Label>
                <Input value={form.owner} onChange={e => set("owner", e.target.value)} placeholder="Who handles this client" />
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
                <Label>Source</Label>
                <Input value={form.source} onChange={e => set("source", e.target.value)} placeholder="Referral, YES Meet, etc." />
              </div>
              <div className="space-y-1.5">
                <Label>Source Pitch</Label>
                <Select value={String(form.source_pitch_id || "")} onValueChange={v => set("source_pitch_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select pitch (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {pitches.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.date})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Any context" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving…</> : id ? "Update" : "Add Client"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Bug Form ─────────────────────────────────────────────────────────────────

const BUG_EMPTY: Partial<OpsBug> = {
  project_id: 0, module: "", description: "", type: "bug", priority: "p2_medium",
  reported_by: "", reported_date: "", status: "open", target_date: "", steps_to_repro: "",
};

function BugForm({ id, body, onClose, onSuccess }: SubFormProps) {
  const [form, setForm]       = useState<Partial<OpsBug>>(BUG_EMPTY);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [employees, setEmployees] = useState<OpsEmployee[]>([]);
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    opsProjectsApi.list().then(r => setProjects((r as any).data ?? [])).catch(() => {});
    opsEmployeesApi.list({ status: "active" }).then(r => setEmployees((r as any).data ?? [])).catch(() => {});

    if (id) {
      opsBugsApi.get(id).then(r => {
        const b = (r as any).data as OpsBug;
        setForm({
          ...BUG_EMPTY,
          project_id:    b.project_id,
          module:        b.module,
          description:   b.description,
          type:          b.type,
          priority:      b.priority,
          reported_by:   b.reported_by,
          reported_date: b.reported_date ?? "",
          developer_id:  b.developer_id ?? undefined,
          qa_id:         b.qa_id ?? undefined,
          status:        b.status,
          target_date:   b.target_date ?? "",
          steps_to_repro: b.steps_to_repro ?? "",
          ...(body as any),
        });
      }).catch(() => toast.error("Could not load bug")).finally(() => setLoading(false));
    } else {
      setForm({ ...BUG_EMPTY, ...(body as any) });
    }
  }, []);

  const set = (k: keyof OpsBug, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id)          { toast.error("Project required"); return; }
    if (!form.description?.trim()) { toast.error("Description required"); return; }
    setSaving(true);
    try {
      if (id) { await opsBugsApi.update(id, form); onSuccess("Bug updated"); }
      else    { await opsBugsApi.create(form);     onSuccess("Bug logged"); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!saving && !v) onClose(); }}>
      <DialogContent className="max-w-2xl" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>{id ? "Edit Bug" : "Add Bug"}</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
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
                    {["open", "in_progress", "fixed", "retest", "closed", "wont_fix"].map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reported By</Label>
                <Input value={form.reported_by ?? ""} onChange={e => set("reported_by", e.target.value)} placeholder="Name" />
              </div>
              <div className="space-y-1.5">
                <Label>Date Client Reported</Label>
                <Input type="date" value={form.reported_date ?? ""} onChange={e => set("reported_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Target Fix Date</Label>
                <Input type="date" value={form.target_date ?? ""} onChange={e => set("target_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Developer</Label>
                <Select value={String(form.developer_id ?? "")} onValueChange={v => set("developer_id", v ? Number(v) : undefined)}>
                  <SelectTrigger><SelectValue placeholder="Assign developer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>QA</Label>
                <Select value={String(form.qa_id ?? "")} onValueChange={v => set("qa_id", v ? Number(v) : undefined)}>
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
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving…</> : id ? "Update" : "Add Bug"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Form ─────────────────────────────────────────────────────────────

const PAYMENT_EMPTY = {
  client_id: 0, project_id: 0, amount: 0,
  type: "advance" as OpsPayment["type"],
  mode: "bank_transfer" as OpsPayment["mode"],
  payment_date: "", notes: "",
};

function PaymentForm({ body, onClose, onSuccess }: SimpleFormProps) {
  const [form, setForm]       = useState({ ...PAYMENT_EMPTY, ...(body as any) });
  const [clients, setClients] = useState<OpsClient[]>([]);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    opsClientsApi.list().then(r => setClients((r as any).data ?? [])).catch(() => {});
    opsProjectsApi.list().then(r => setProjects((r as any).data ?? [])).catch(() => {});
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const clientProjects = form.client_id
    ? projects.filter(p => p.client_id === Number(form.client_id))
    : projects;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.project_id) { toast.error("Project required"); return; }
    if (!form.amount)     { toast.error("Amount required"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        payment_date: form.payment_date || new Date().toISOString().split("T")[0],
        recorded_by: "AI Assistant",
      };
      await opsFinanceApi.addPayment(payload);
      onSuccess(`Payment of ₹${Number(form.amount).toLocaleString("en-IN")} recorded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!saving && !v) onClose(); }}>
      <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>Log Payment</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={String(form.client_id || "")} onValueChange={v => set("client_id", Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Project *</Label>
              <Select value={String(form.project_id || "")} onValueChange={v => set("project_id", Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {clientProjects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input type="number" value={form.amount || ""} onChange={e => set("amount", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["advance", "mid", "final", "amc", "other"].map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={form.mode} onValueChange={v => set("mode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["bank_transfer","Bank Transfer"],["cash","Cash"],["upi","UPI"],["cheque","Cheque"],["other","Other"]].map(([v,l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input type="date" value={form.payment_date} onChange={e => set("payment_date", e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving…</> : "Log Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Expense Form ─────────────────────────────────────────────────────────────

const EXPENSE_EMPTY = {
  category: "other" as OpsExpense["category"],
  amount: 0, description: "", project_id: undefined as number | undefined, date: "",
};

function ExpenseForm({ body, onClose, onSuccess }: SimpleFormProps) {
  const [form, setForm]       = useState({ ...EXPENSE_EMPTY, ...(body as any) });
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    opsProjectsApi.list().then(r => setProjects((r as any).data ?? [])).catch(() => {});
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount) { toast.error("Amount required"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        date: form.date || new Date().toISOString().split("T")[0],
        added_by: "AI Assistant",
      };
      await opsFinanceApi.addExpense(payload);
      onSuccess(`Expense of ₹${Number(form.amount).toLocaleString("en-IN")} logged`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!saving && !v) onClose(); }}>
      <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>Log Expense</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input type="number" value={form.amount || ""} onChange={e => set("amount", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["hosting", "tools", "travel", "marketing", "salary", "pitch", "other"].map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="What was this expense for?" />
            </div>
            <div className="space-y-1.5">
              <Label>Project (optional)</Label>
              <Select value={String(form.project_id || "")} onValueChange={v => set("project_id", v ? Number(v) : undefined)}>
                <SelectTrigger><SelectValue placeholder="Link to project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving…</> : "Log Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Fallback — unmapped path ─────────────────────────────────────────────────

function FallbackForm({ pendingEdit, onClose, onSuccess }: { pendingEdit: PendingEdit; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [executing, setExecuting] = useState(false);

  const handleConfirm = async () => {
    if (!pendingEdit.token) { toast.error("No token available for this action"); return; }
    setExecuting(true);
    try {
      const res = await opsAiCommandApi.execute(pendingEdit.token);
      const msg = (res as any)?.data?.message ?? "Done";
      onSuccess(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Execute failed");
    } finally { setExecuting(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!executing && !v) onClose(); }}>
      <DialogContent className="max-w-sm" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader><DialogTitle>Confirm Action</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          No edit form is available for this action type. Confirm to execute directly?
        </p>
        <p className="text-xs bg-muted rounded-md p-3 font-mono text-muted-foreground break-all">
          {pendingEdit.method} {pendingEdit.path}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={executing}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={executing}>
            {executing ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Executing…</> : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
