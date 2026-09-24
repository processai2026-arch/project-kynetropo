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
import { opsMeetingsApi, opsClientsApi, opsProjectsApi } from "@/lib/api/ops";
import type { OpsMeeting, OpsClient, OpsProject } from "@/types/ops";
import { CalendarDays, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  google_meet: "Google Meet", in_person: "In-Person",
  phone_call: "Phone Call",  whatsapp_call: "WhatsApp",
};

const EMPTY: Partial<OpsMeeting> = {
  client_id: undefined, project_id: undefined, date: "", type: "google_meet",
  link: "", attendees: "", agenda: "", outcome: "", next_action: "", next_followup: "", booked_by: "",
};

export default function Meetings() {
  const [items, setItems]       = useState<OpsMeeting[]>([]);
  const [clients, setClients]   = useState<OpsClient[]>([]);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [clientFilter, setClientFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<OpsMeeting | null>(null);
  const [form, setForm]         = useState<Partial<OpsMeeting>>(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (clientFilter !== "all") params.client_id = clientFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo)   params.date_to   = dateTo;
      const res = await opsMeetingsApi.list(params);
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load meetings"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientFilter, dateFrom, dateTo]);
  useEffect(() => {
    opsClientsApi.list().then(r => setClients((r as any).data ?? [])).catch(() => {});
    opsProjectsApi.list().then(r => setProjects((r as any).data ?? [])).catch(() => {});
  }, []);

  const set = (k: keyof OpsMeeting, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const clientProjects = form.client_id
    ? projects.filter(p => p.client_id === (form.client_id as number))
    : projects;

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit   = (m: OpsMeeting) => {
    setEditing(m);
    setForm({ client_id: m.client_id ?? undefined, project_id: m.project_id ?? undefined,
              date: m.date?.slice(0,16) ?? "", type: m.type, link: m.link ?? "",
              attendees: m.attendees ?? "", agenda: m.agenda ?? "", outcome: m.outcome ?? "",
              next_action: m.next_action ?? "", next_followup: m.next_followup ?? "", booked_by: m.booked_by });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) { toast.error("Date is required"); return; }
    setSaving(true);
    try {
      if (editing) { await opsMeetingsApi.update(editing.id, form); toast.success("Meeting updated"); }
      else         { await opsMeetingsApi.create(form);              toast.success("Meeting scheduled"); }
      setFormOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally       { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Meetings</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Schedule Meeting</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" />
        <Input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className="w-[160px]" />
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">All Meetings ({items.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Date","Client","Project","Type","Outcome","Next Follow-up","Booked By",""].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 8 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>)}
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-sm">No meetings found</td></tr>
                )}
                {!loading && items.map(m => (
                  <tr key={m.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-card-foreground">
                      {new Date(m.date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}
                    </td>
                    <td className="py-3 px-4 text-card-foreground">{m.client_name ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{m.project_name ?? "—"}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs">{typeLabels[m.type] ?? m.type}</Badge>
                    </td>
                    <td className="py-3 px-4 text-card-foreground max-w-[180px] truncate">{m.outcome || "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{m.next_followup ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{m.booked_by || "—"}</td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Meeting" : "Schedule Meeting"}</DialogTitle></DialogHeader>
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
                    {Object.entries(typeLabels).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
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
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Schedule"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
