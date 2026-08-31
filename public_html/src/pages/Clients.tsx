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
import { opsClientsApi, opsPitchesApi } from "@/lib/api/ops";
import type { OpsClient, OpsPitch } from "@/types/ops";
import { Users, Plus, Search, Eye } from "lucide-react";
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

const EMPTY = {
  name: "", phone: "", email: "", source: "", source_pitch_id: "" as string | number,
  owner: "", health: "green" as const, notes: "",
};

export default function Clients() {
  const [items, setItems]       = useState<OpsClient[]>([]);
  const [pitches, setPitches]   = useState<OpsPitch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [stageFilter, setStageFilter]   = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [ownerFilter, setOwnerFilter]   = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<OpsClient | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (stageFilter !== "all")  params.stage  = stageFilter;
      if (healthFilter !== "all") params.health = healthFilter;
      if (ownerFilter !== "all")  params.owner  = ownerFilter;
      const res = await opsClientsApi.list(params);
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load clients"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [stageFilter, healthFilter, ownerFilter]);

  useEffect(() => {
    opsPitchesApi.list().then(r => setPitches((r as any).data ?? [])).catch(() => {});
  }, []);

  const owners = [...new Set(items.map(c => c.owner).filter(Boolean))];
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit   = (c: OpsClient) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, email: c.email, source: c.source,
              source_pitch_id: c.source_pitch_id ?? "", owner: c.owner,
              health: c.health, notes: c.notes ?? "" });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, source_pitch_id: form.source_pitch_id ? Number(form.source_pitch_id) : null };
      if (editing) { await opsClientsApi.update(editing.id, payload); toast.success("Client updated"); }
      else         { await opsClientsApi.create(payload);              toast.success("Client added"); }
      setFormOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally       { setSaving(false); }
  };

  const filtered = search
    ? items.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.owner.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Client</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, phone, email…" className="pl-9" value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All stages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {CLIENT_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={healthFilter} onValueChange={setHealthFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All health" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            <SelectItem value="green">Green</SelectItem>
            <SelectItem value="yellow">Yellow</SelectItem>
            <SelectItem value="red">Red</SelectItem>
          </SelectContent>
        </Select>
        {owners.length > 0 && (
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All owners" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">All Clients ({filtered.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Name","Stage","Health","Balance Due","Next Follow-up","Owner","Days Since Contact",""].map(h => (
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
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-sm">No clients found</td></tr>
                )}
                {!loading && filtered.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-card-foreground">{c.name}</div>
                      {c.project_name && <div className="text-xs text-muted-foreground">{c.project_name}</div>}
                    </td>
                    <td className="py-3 px-4 text-xs text-card-foreground">{c.stage}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", healthStyles[c.health] ?? "bg-muted text-muted-foreground")}>{c.health}</Badge>
                    </td>
                    <td className="py-3 px-4 text-card-foreground">
                      {c.balance_due != null ? "₹" + Number(c.balance_due).toLocaleString("en-IN") : "—"}
                    </td>
                    <td className="py-3 px-4 text-card-foreground">{c.next_followup ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{c.owner || "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">
                      {c.days_since_contact != null ? `${c.days_since_contact}d ago` : "—"}
                    </td>
                    <td className="py-3 px-4 flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Edit">
                        <Search className="h-4 w-4" />
                      </Button>
                      <Link to={`/clients/${c.id}`}>
                        <Button variant="ghost" size="icon" title="View detail"><Eye className="h-4 w-4" /></Button>
                      </Link>
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
            <DialogTitle>{editing ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
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
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add Client"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
