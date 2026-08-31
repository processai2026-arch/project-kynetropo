import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Package, Plus, Pencil, Trash2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { cn } from "@/lib/utils";
import { invoiceProductsApi } from "@/lib/api/invoiceProducts";
import type { InvoiceProduct } from "@/types/invoiceProduct";

const EMPTY: Partial<InvoiceProduct> = {
  sku: "", name: "", category: "", hsn_code: "", unit: "pcs",
  input_gst_rate: 0, input_gst_amount: 0,
  cost_price: 0, selling_price: 0, current_stock: 0, damaged_stock: 0,
  min_stock_level: 5, max_stock_level: 100,
};

export default function InvoiceProducts() {
  const [items, setItems] = useState<InvoiceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceProduct | null>(null);
  const [form, setForm] = useState<Partial<InvoiceProduct>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<InvoiceProduct | null>(null);

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
      const res = await invoiceProductsApi.list();
      setItems(res.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const result = items.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q);
      const matchStock = stockFilter === "all" ? true
        : stockFilter === "low" ? p.current_stock > 0 && p.current_stock <= p.min_stock_level
        : stockFilter === "zero" ? p.current_stock <= 0
        : p.current_stock > p.min_stock_level;
      return matchSearch && matchStock;
    });
    return [...result].sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const numKeys = ["total_amount", "tax_amount", "amount", "lifetime_revenue", "current_stock", "damaged_stock", "cost_price", "selling_price", "min_stock_level", "max_stock_level", "input_gst_rate", "input_gst_amount"];
      const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, search, stockFilter, sortKey, sortDir]);

  const totalActive = useMemo(() => items.filter(p => p.is_active).length, [items]);
  const lowStockCount = useMemo(() => items.filter(p => p.current_stock > 0 && p.current_stock <= p.min_stock_level).length, [items]);
  const outOfStock = useMemo(() => items.filter(p => p.current_stock <= 0).length, [items]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit = (p: InvoiceProduct) => { setEditing(p); setForm({ ...p }); setFormOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku?.trim() || !form.name?.trim()) { toast.error("SKU and name are required"); return; }
    setSaving(true);
    try {
      if (editing) { await invoiceProductsApi.update(editing.product_id, form); toast.success("Product updated"); }
      else { await invoiceProductsApi.create(form); toast.success("Product created"); }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await invoiceProductsApi.remove(confirmDelete.product_id);
      toast.success("Product deleted");
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Invoice Products</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active Products" value={String(totalActive)} icon={Package} subtitleColor="muted" />
        <StatCard title="Low Stock" value={String(lowStockCount)} subtitle="At or below min level" icon={AlertTriangle} subtitleColor="muted" />
        <StatCard title="Out of Stock" value={String(outOfStock)} icon={AlertTriangle} subtitleColor="muted" />
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <Input placeholder="Search SKU, name, category…" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="zero">Out of Stock</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
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
                  <th onClick={() => handleSort("sku")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">SKU<SortIcon col="sku" /></th>
                  <th onClick={() => handleSort("name")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Product<SortIcon col="name" /></th>
                  <th onClick={() => handleSort("category")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Category<SortIcon col="category" /></th>
                  <th onClick={() => handleSort("current_stock")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Stock<SortIcon col="current_stock" /></th>
                  <th onClick={() => handleSort("damaged_stock")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Damaged<SortIcon col="damaged_stock" /></th>
                  <th onClick={() => handleSort("min_stock_level")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Min<SortIcon col="min_stock_level" /></th>
                  <th onClick={() => handleSort("cost_price")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Cost<SortIcon col="cost_price" /></th>
                  <th onClick={() => handleSort("selling_price")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Sell Price<SortIcon col="selling_price" /></th>
                  <th onClick={() => handleSort("is_active")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Status<SortIcon col="is_active" /></th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-6 py-8 text-center text-muted-foreground text-sm">No products found</td></tr>
                )}
                {!loading && filtered.map(p => {
                  const stockPct = Math.min(100, (p.current_stock / Math.max(p.max_stock_level, 1)) * 100);
                  const isLow = p.current_stock > 0 && p.current_stock <= p.min_stock_level;
                  const isOut = p.current_stock <= 0;
                  return (
                    <tr key={p.product_id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-card-foreground">{p.sku}</td>
                      <td className="py-3 px-4 font-medium text-card-foreground">{p.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{p.category ?? "—"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium", isOut ? "text-destructive" : isLow ? "text-amber-600" : "text-card-foreground")}>{p.current_stock}</span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", isOut ? "bg-destructive" : isLow ? "bg-amber-500" : "bg-primary")} style={{ width: `${stockPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {p.damaged_stock > 0
                          ? <Badge className="border bg-red-50 text-red-600 border-red-200">{p.damaged_stock}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{p.min_stock_level}</td>
                      <td className="py-3 px-4 text-card-foreground">₹{p.cost_price.toFixed(2)}</td>
                      <td className="py-3 px-4 text-card-foreground">₹{p.selling_price.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize", p.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200")}>
                          {p.is_active ? "active" : "inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent className="max-w-2xl" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU *</Label>
                <Input id="sku" value={form.sku ?? ""} onChange={e => set("sku", e.target.value)} disabled={!!editing} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <CreatableCombobox optionsKey="product_category" value={form.category ?? ""} onChange={v => set("category", v)} placeholder="Select or type category…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hsn">HSN Code</Label>
                <Input id="hsn" value={form.hsn_code ?? ""} onChange={e => set("hsn_code", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit">Unit</Label>
                <CreatableCombobox optionsKey="product_unit" value={form.unit ?? "pcs"} onChange={v => set("unit", v)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost">Cost Price (₹)</Label>
                <Input id="cost" type="number" value={form.cost_price ?? 0}
                  onChange={e => {
                    const cost = Number(e.target.value);
                    const rate = form.input_gst_rate ?? 0;
                    set("cost_price", cost);
                    if (rate > 0) set("input_gst_amount", parseFloat((cost * rate / 100).toFixed(2)));
                  }} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sell">Selling Price (₹)</Label>
                <Input id="sell" type="number" value={form.selling_price ?? 0} onChange={e => set("selling_price", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock">Current Stock</Label>
                <Input id="stock" type="number" value={form.current_stock ?? 0} onChange={e => set("current_stock", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minstock">Min Stock Level</Label>
                <Input id="minstock" type="number" value={form.min_stock_level ?? 5} onChange={e => set("min_stock_level", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxstock">Max Stock Level</Label>
                <Input id="maxstock" type="number" value={form.max_stock_level ?? 100} onChange={e => set("max_stock_level", Number(e.target.value))} />
              </div>
            </div>

            {/* Input GST section */}
            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-foreground">Input GST (Purchase Tax / ITC)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gst_rate">GST Rate (%)</Label>
                  <select
                    id="gst_rate"
                    value={form.input_gst_rate ?? 0}
                    onChange={e => {
                      const rate = Number(e.target.value);
                      const cost = form.cost_price ?? 0;
                      set("input_gst_rate", rate);
                      set("input_gst_amount", cost > 0 && rate > 0 ? parseFloat((cost * rate / 100).toFixed(2)) : 0);
                    }}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gst_amt">GST Amount (₹) <span className="text-xs text-muted-foreground">auto-calculated</span></Label>
                  <Input
                    id="gst_amt"
                    type="number"
                    value={form.input_gst_amount ?? 0}
                    onChange={e => set("input_gst_amount", Number(e.target.value))}
                  />
                </div>
              </div>
            </section>

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
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete {confirmDelete?.name}. This cannot be undone.</AlertDialogDescription>
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
