import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { productsApi } from "@/lib/api/krish";
import type { Product } from "@/types/krish";
import { Package, Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
  name: "",
  sku: "",
  category: "",
  description: "",
  unit: "",
  unit_price: 0,
  stock_qty: 0,
  is_active: true,
};

export default function Products() {
  const [items, setItems]               = useState<Product[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [formOpen, setFormOpen]         = useState(false);
  const [editing, setEditing]           = useState<Product | null>(null);
  const [form, setForm]                 = useState(EMPTY);
  const [saving, setSaving]             = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (activeFilter !== "all") params.is_active = activeFilter === "active" ? "1" : "0";
      const res = await productsApi.list(params);
      setItems((res as any).data ?? []);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeFilter]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit   = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category ?? "",
      description: p.description ?? "",
      unit: p.unit,
      unit_price: p.unit_price,
      stock_qty: p.stock_qty,
      is_active: p.is_active,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())   { toast.error("Name is required"); return; }
    if (!form.sku.trim())    { toast.error("SKU is required"); return; }
    if (form.unit_price < 0) { toast.error("Unit price must be 0 or greater"); return; }
    setSaving(true);
    try {
      if (editing) {
        await productsApi.update(editing.id, form);
        toast.success("Product updated");
      } else {
        await productsApi.create(form);
        toast.success("Product created");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter(p => {
    if (search &&
      !p.name.toLowerCase().includes(search.toLowerCase()) &&
      !p.sku.toLowerCase().includes(search.toLowerCase()) &&
      !(p.category ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && !(p.category ?? "").toLowerCase().includes(categoryFilter.toLowerCase())) return false;
    if (activeFilter === "active"   && !p.is_active) return false;
    if (activeFilter === "inactive" &&  p.is_active) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Products</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, SKU, category..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()}
          />
        </div>
        <Input
          placeholder="Filter by category..."
          className="w-[180px]"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        />
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-card-foreground">Consumables Catalog ({filtered.length})</h2>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {["Name", "SKU", "Category", "Unit", "Price (Rs.)", "Stock Qty", "Active", "Actions"].map(h => (
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
                    <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-sm">No products found</td>
                  </tr>
                )}
                {!loading && filtered.map(p => (
                  <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-card-foreground">{p.name}</td>
                    <td className="py-3 px-4 text-card-foreground font-mono text-xs">{p.sku}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.category ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.unit}</td>
                    <td className="py-3 px-4 text-card-foreground">Rs.{Number(p.unit_price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.stock_qty}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", p.is_active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-gray-100 text-gray-500 border-gray-200"
                      )}>
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
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
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Product name" />
              </div>
              <div className="space-y-1.5">
                <Label>SKU *</Label>
                <Input value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="e.g. FLT-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input value={form.category} onChange={e => set("category", e.target.value)} placeholder="Filter, Chemical, Spare Part" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input value={form.unit} onChange={e => set("unit", e.target.value)} placeholder="Piece / Litre / Pack" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Price (Rs.) *</Label>
                <Input type="number" min="0" step="0.01" value={form.unit_price} onChange={e => set("unit_price", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock Qty</Label>
                <Input type="number" min="0" value={form.stock_qty} onChange={e => set("stock_qty", parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} placeholder="Optional description" />
              </div>
              <div className="space-y-1.5 col-span-2 flex items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={v => set("is_active", v)} id="prod_is_active" />
                <Label htmlFor="prod_is_active">Active</Label>
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
