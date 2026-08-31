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
import { opsPitchesApi } from "@/lib/api/ops";
import type { OpsPitch } from "@/types/ops";
import { Megaphone, Plus, Pencil, Eye, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const typeLabels: Record<string, string> = {
  yes_meeting: "YES Meeting", business_forum: "Business Forum",
  cold_outreach: "Cold Outreach", referral_event: "Referral Event",
  online: "Online", other: "Other",
};

const EMPTY = { name: "", date: "", venue: "", city: "", type: "yes_meeting", spend: 0, description: "" };

export default function Pitches() {
  const [items, setItems]   = useState<OpsPitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<OpsPitch | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await opsPitchesApi.list();
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load pitches"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit   = (p: OpsPitch) => {
    setEditing(p);
    setForm({ name: p.name, date: p.date, venue: p.venue ?? "", city: p.city ?? "",
              type: p.type, spend: p.spend, description: p.description ?? "" });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Event name required"); return; }
    if (!form.date)        { toast.error("Date required"); return; }
    setSaving(true);
    try {
      if (editing) { await opsPitchesApi.update(editing.id, form); toast.success("Pitch updated"); }
      else         { await opsPitchesApi.create(form);              toast.success("Pitch added"); }
      setFormOpen(false); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally       { setSaving(false); }
  };

  const totalSpend   = items.reduce((s, p) => s + p.spend, 0);
  const totalRevenue = items.reduce((s, p) => s + p.revenue, 0);
  const totalLeads   = items.reduce((s, p) => s + p.leads_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Pitches &amp; Marketing</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Pitch</Button>
      </div>

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Events", value: String(items.length) },
            { label: "Total Leads", value: String(totalLeads) },
            { label: "Total Spend", value: "₹" + totalSpend.toLocaleString("en-IN") },
            { label: "Total Revenue", value: "₹" + totalRevenue.toLocaleString("en-IN") },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border shadow-sm p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1 text-card-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">All Pitch Events ({items.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Event","Date","City","Type","Spend","Leads","Converted","Conv %","Revenue","ROI",""].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 11 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-14" /></td>)}</tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={11} className="px-6 py-8 text-center text-muted-foreground text-sm">No pitch events yet</td></tr>
                )}
                {!loading && items.map(p => (
                  <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-card-foreground">{p.name}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.date}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.city ?? "—"}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs">{typeLabels[p.type] ?? p.type}</Badge>
                    </td>
                    <td className="py-3 px-4 text-card-foreground">₹{Number(p.spend).toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.leads_count}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.converted}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.conversion_pct}%</td>
                    <td className="py-3 px-4 text-emerald-700 font-medium">₹{Number(p.revenue).toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4">
                      {p.roi != null ? (
                        <span className={cn("font-medium", p.roi >= 0 ? "text-emerald-700" : "text-red-600")}>
                          {p.roi >= 0 ? "+" : ""}{p.roi}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-4 flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Link to={`/pitches/${p.id}`}><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editing ? "Edit Pitch" : "Add Pitch Event"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Event Name *</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. YES Meet Kanchipuram" />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => set("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Venue</Label>
                <Input value={form.venue} onChange={e => set("venue", e.target.value)} placeholder="Venue name" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Chennai" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Spend (₹) — travel, food, registration</Label>
                <Input type="number" value={form.spend || ""} onChange={e => set("spend", Number(e.target.value))} placeholder="0" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Who you met, what worked, observations…" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add Pitch"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
