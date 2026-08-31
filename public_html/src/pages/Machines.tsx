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
import { machinesApi, customersApi } from "@/lib/api/krish";
import type { Machine, Customer } from "@/types/krish";
import { Cpu, Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  active:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive:     "bg-gray-100 text-gray-500 border-gray-200",
  under_repair: "bg-amber-50 text-amber-600 border-amber-200",
};

const EMPTY = { machine_id: "", model: "", category: "", customer_id: 0, location_name: "", address: "", latitude: "", longitude: "", geofence_radius_m: 100, installed_date: "", warranty_expiry: "", status: "active" as const, notes: "" };

export default function Machines() {
  const [items, setItems]       = useState<Machine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing]   = useState<Machine | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (search) params.search = search;
      const res = await machinesApi.list(params);
      setItems((res as any).data ?? []);
    } catch { toast.error("Failed to load machines"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);
  useEffect(() => {
    customersApi.list({ status: "active" }).then(r => setCustomers((r as any).data ?? [])).catch(() => {});
  }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit   = (m: Machine) => {
    setEditing(m);
    setForm({ machine_id: m.machine_id, model: m.model, category: m.category ?? "", customer_id: m.customer_id, location_name: m.location_name, address: m.address ?? "", latitude: m.latitude?.toString() ?? "", longitude: m.longitude?.toString() ?? "", geofence_radius_m: m.geofence_radius_m, installed_date: m.installed_date ?? "", warranty_expiry: m.warranty_expiry ?? "", status: m.status, notes: m.notes ?? "" });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.machine_id.trim()) { toast.error("Machine ID is required"); return; }
    if (!form.model.trim())      { toast.error("Model is required"); return; }
    if (!form.customer_id)       { toast.error("Customer is required"); return; }
    if (!form.location_name.trim()) { toast.error("Location name is required"); return; }

    setSaving(true);
    try {
      const body = { ...form, latitude: form.latitude ? parseFloat(form.latitude as string) : null, longitude: form.longitude ? parseFloat(form.longitude as string) : null };
      if (editing) { await machinesApi.update(editing.id, body); toast.success("Machine updated"); }
      else         { await machinesApi.create(body);             toast.success("Machine created"); }
      setFormOpen(false);
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const filtered = search ? items.filter(m =>
    m.machine_id.toLowerCase().includes(search.toLowerCase()) ||
    m.model.toLowerCase().includes(search.toLowerCase()) ||
    (m.customer_name ?? "").toLowerCase().includes(search.toLowerCase())
  ) : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Machines</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Machine</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search machines…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="under_repair">Under Repair</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">All Machines ({filtered.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Machine ID","Model","Category","Customer","Location","Status","Actions"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                  ))}</tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No machines found</td></tr>
                )}
                {!loading && filtered.map(m => (
                  <tr key={m.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-card-foreground">{m.machine_id}</td>
                    <td className="py-3 px-4 text-card-foreground">{m.model}</td>
                    <td className="py-3 px-4 text-card-foreground">{m.category ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{m.customer_name ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{m.location_name}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", statusStyles[m.status] ?? "bg-muted text-muted-foreground")}>{m.status.replace(/_/g, " ")}</Badge>
                    </td>
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
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Machine" : "Add Machine"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Machine ID *</Label>
                <Input value={form.machine_id} onChange={e => set("machine_id", e.target.value)} placeholder="e.g. KA-001" disabled={!!editing} />
              </div>
              <div className="space-y-1.5">
                <Label>Model *</Label>
                <Input value={form.model} onChange={e => set("model", e.target.value)} placeholder="Machine model" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input value={form.category} onChange={e => set("category", e.target.value)} placeholder="e.g. RO Purifier" />
              </div>
              <div className="space-y-1.5">
                <Label>Customer *</Label>
                <Select value={form.customer_id ? String(form.customer_id) : ""} onValueChange={v => set("customer_id", parseInt(v))}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location Name *</Label>
                <Input value={form.location_name} onChange={e => set("location_name", e.target.value)} placeholder="e.g. Main Hall" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="under_repair">Under Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Installation address" />
              </div>
              <div className="space-y-1.5">
                <Label>Installed Date</Label>
                <Input type="date" value={form.installed_date} onChange={e => set("installed_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Warranty Expiry</Label>
                <Input type="date" value={form.warranty_expiry} onChange={e => set("warranty_expiry", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>GPS Latitude</Label>
                <Input type="number" step="any" value={form.latitude} onChange={e => set("latitude", e.target.value)} placeholder="12.9716" />
              </div>
              <div className="space-y-1.5">
                <Label>GPS Longitude</Label>
                <Input type="number" step="any" value={form.longitude} onChange={e => set("longitude", e.target.value)} placeholder="77.5946" />
              </div>
              <div className="space-y-1.5">
                <Label>Geofence Radius (m)</Label>
                <Input type="number" value={form.geofence_radius_m} onChange={e => set("geofence_radius_m", parseInt(e.target.value))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
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
