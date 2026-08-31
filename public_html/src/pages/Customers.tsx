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
import { customersApi } from "@/lib/api/krish";
import type { Customer } from "@/types/krish";
import { Users, Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
};

const EMPTY = {
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  status: "active" as const,
  notes: "",
};

export default function Customers() {
  const [items, setItems]         = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<Customer | null>(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (search) params.search = search;
      const res = await customersApi.list(params);
      setItems((res as any).data ?? []);
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit   = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      contact_person: c.contact_person ?? "",
      email: c.email,
      phone: c.phone,
      address: c.address ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      status: c.status,
      notes: c.notes ?? "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())  { toast.error("Name is required"); return; }
    if (!form.email.trim()) { toast.error("Email is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone is required"); return; }
    setSaving(true);
    try {
      if (editing) {
        await customersApi.update(editing.id, form);
        toast.success("Customer updated");
      } else {
        await customersApi.create(form);
        toast.success("Customer created");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const filtered = search
    ? items.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        (c.contact_person ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Customers</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">All Customers ({filtered.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Name", "Contact Person", "Email", "Phone", "City", "State", "Status", "Actions"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-sm">No customers found</td>
                  </tr>
                )}
                {!loading && filtered.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-card-foreground">{c.name}</td>
                    <td className="py-3 px-4 text-card-foreground">{c.contact_person ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{c.email}</td>
                    <td className="py-3 px-4 text-card-foreground">{c.phone}</td>
                    <td className="py-3 px-4 text-card-foreground">{c.city ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{c.state ?? "—"}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", statusStyles[c.status] ?? "bg-muted text-muted-foreground")}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Customer / company name" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input value={form.contact_person} onChange={e => set("contact_person", e.target.value)} placeholder="Primary contact name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone *</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 9876543210" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input value={form.state} onChange={e => set("state", e.target.value)} placeholder="State" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Address</Label>
                <Textarea value={form.address} onChange={e => set("address", e.target.value)} rows={2} placeholder="Full address" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
