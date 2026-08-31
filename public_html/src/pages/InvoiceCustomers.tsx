import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, ShoppingBag, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { invoiceCustomersApi } from "@/lib/api/invoiceCustomers";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import type { InvoiceCustomer } from "@/types/invoiceCustomer";

const EMPTY: Partial<InvoiceCustomer> = { name: "", email: "", phone: "", gstin: "", address_line1: "", city: "", state: "", pincode: "", customer_type: "b2c" };

export default function InvoiceCustomers() {
  const [items, setItems] = useState<InvoiceCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceCustomer | null>(null);
  const [form, setForm] = useState<Partial<InvoiceCustomer>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<InvoiceCustomer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<InvoiceCustomer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const resetSort = () => { setSortKey("created_at"); setSortDir("desc"); };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" /> : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await invoiceCustomersApi.list();
      setItems(res.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load customers");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const f = items.filter(c => {
      const q = search.toLowerCase();
      const ms = !q || c.name.toLowerCase().includes(q) || (c.gstin ?? "").toLowerCase().includes(q) || (c.city ?? "").toLowerCase().includes(q);
      const mt = typeFilter === "all" || c.customer_type === typeFilter;
      return ms && mt;
    });
    return [...f].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey] ?? "";
      const bv = (b as unknown as Record<string, unknown>)[sortKey] ?? "";
      const numKeys = ["total_amount", "tax_amount", "amount", "lifetime_revenue", "current_stock", "damaged_stock"];
      const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, search, typeFilter, sortKey, sortDir]);

  const b2bCount = useMemo(() => items.filter(c => c.customer_type === "b2b").length, [items]);
  const b2cCount = useMemo(() => items.filter(c => c.customer_type === "b2c").length, [items]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit = (c: InvoiceCustomer) => { setEditing(c); setForm({ ...c }); setFormOpen(true); };

  const openDetail = async (c: InvoiceCustomer) => {
    setDetailCustomer(c);
    setDetailLoading(true);
    try {
      const full = await invoiceCustomersApi.purchases(c.customer_id);
      setDetailCustomer(full);
    } catch { /* show with existing data */ }
    finally { setDetailLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (editing) { await invoiceCustomersApi.update(editing.customer_id, form); toast.success("Customer updated"); }
      else { await invoiceCustomersApi.create(form); toast.success("Customer created"); }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await invoiceCustomersApi.remove(confirmDelete.customer_id);
      toast.success("Customer deleted");
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Invoice Customers</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Customers" value={String(items.length)} icon={Users} subtitleColor="muted" subtitle={""} />
        <StatCard title="B2B" value={String(b2bCount)} subtitle="Business customers" icon={Users} subtitleColor="muted" />
        <StatCard title="B2C" value={String(b2cCount)} subtitle="Individual customers" icon={Users} subtitleColor="muted" />
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <Input placeholder="Search name, GSTIN, city…" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="b2b">B2B</SelectItem>
              <SelectItem value="b2c">B2C</SelectItem>
            </SelectContent>
          </Select>
          {sortKey !== "created_at" && (
            <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
            </Button>
          )}
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th onClick={() => handleSort("name")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">Name<SortIcon col="name" /></th>
                  <th onClick={() => handleSort("email")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">Email<SortIcon col="email" /></th>
                  <th onClick={() => handleSort("phone")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">Phone<SortIcon col="phone" /></th>
                  <th onClick={() => handleSort("gstin")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">GSTIN<SortIcon col="gstin" /></th>
                  <th onClick={() => handleSort("city")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">City<SortIcon col="city" /></th>
                  <th onClick={() => handleSort("customer_type")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">Type<SortIcon col="customer_type" /></th>
                  <th onClick={() => handleSort("lifetime_revenue")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">Revenue<SortIcon col="lifetime_revenue" /></th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 8 }).map((_, j) => (<td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>))}</tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-sm">No customers found</td></tr>
                )}
                {!loading && filtered.map(c => (
                  <tr key={c.customer_id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openDetail(c)}>
                    <td className="py-3 px-4 font-medium text-card-foreground">{c.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="py-3 px-4 font-mono text-xs text-card-foreground">{c.gstin ?? "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.city ?? "—"}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border uppercase text-xs", c.customer_type === "b2b" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-gray-100 text-gray-500 border-gray-200")}>
                        {c.customer_type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-card-foreground">₹{c.lifetime_revenue.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Customer Detail Dialog */}
      <Dialog open={!!detailCustomer} onOpenChange={v => !v && setDetailCustomer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{detailCustomer?.name}</DialogTitle></DialogHeader>
          {detailLoading ? <Skeleton className="h-32" /> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[["Email", detailCustomer?.email], ["Phone", detailCustomer?.phone], ["GSTIN", detailCustomer?.gstin], ["Type", detailCustomer?.customer_type?.toUpperCase()], ["City", detailCustomer?.city], ["State", detailCustomer?.state], ["Address", detailCustomer?.address_line1], ["Pincode", detailCustomer?.pincode]].map(([label, value]) => (
                  <div key={label as string}><span className="text-muted-foreground">{label}: </span><span className="text-card-foreground">{value ?? "—"}</span></div>
                ))}
              </div>
              {detailCustomer?.purchases && detailCustomer.purchases.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1"><ShoppingBag className="h-4 w-4" />Purchase History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b bg-muted/50">{["Date","Order#","Platform","Amount","Status"].map(h => <th key={h} className="text-left py-2 px-3 text-muted-foreground uppercase">{h}</th>)}</tr></thead>
                      <tbody>
                        {detailCustomer.purchases.map(p => (
                          <tr key={p.order_id} className="border-b hover:bg-muted/30">
                            <td className="py-2 px-3">{p.order_date}</td>
                            <td className="py-2 px-3 font-mono">{p.order_number}</td>
                            <td className="py-2 px-3 capitalize">{p.marketplace}</td>
                            <td className="py-2 px-3">₹{p.total_amount.toLocaleString("en-IN")}</td>
                            <td className="py-2 px-3 capitalize">{p.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-xl" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Name *</Label>
                <Input value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>GSTIN</Label><Input value={form.gstin ?? ""} onChange={e => set("gstin", e.target.value.toUpperCase())} /></div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <CreatableCombobox optionsKey="customer_type" value={form.customer_type ?? "b2c"} onChange={v => set("customer_type", v)} placeholder="Select type…" />
              </div>
              <div className="space-y-1.5"><Label>City</Label><Input value={form.city ?? ""} onChange={e => set("city", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>State</Label><Input value={form.state ?? ""} onChange={e => set("state", e.target.value)} /></div>
              <div className="space-y-1.5 col-span-2"><Label>Address</Label><Input value={form.address_line1 ?? ""} onChange={e => set("address_line1", e.target.value)} placeholder="Street / area" /></div>
              <div className="space-y-1.5"><Label>Pincode</Label><Input value={form.pincode ?? ""} onChange={e => set("pincode", e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete {confirmDelete?.name}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
