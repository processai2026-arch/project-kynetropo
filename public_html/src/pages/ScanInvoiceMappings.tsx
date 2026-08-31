import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Link2, ChevronDown, ChevronUp, Pencil, Trash2, Plus, X, Check, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { productMappingsApi } from "@/lib/api/productMappings";
import { invoiceProductsApi } from "@/lib/api/invoiceProducts";
import type { ProductMapping } from "@/types/productMapping";
import type { InvoiceProduct } from "@/types/invoiceProduct";

export default function ScanInvoiceMappings() {
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [products, setProducts] = useState<InvoiceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<Array<{ product_id: number | ""; quantity: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProductMapping | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([productMappingsApi.list(), invoiceProductsApi.list()]);
      setMappings(m);
      setProducts(p.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return mappings;
    const q = search.toLowerCase();
    return mappings.filter(m => m.invoice_product_name.toLowerCase().includes(q));
  }, [mappings, search]);

  const startEdit = (m: ProductMapping) => {
    setEditingId(m.mapping_id);
    setEditRows(m.items.map(it => ({ product_id: it.product_id, quantity: it.quantity })));
    setExpandedId(m.mapping_id);
  };

  const cancelEdit = () => { setEditingId(null); setEditRows([]); };

  const saveEdit = async (m: ProductMapping) => {
    const valid = editRows.filter(r => r.product_id !== "" && r.quantity > 0);
    if (valid.length === 0) { toast.error("Add at least one product"); return; }
    setSaving(true);
    try {
      await productMappingsApi.update(m.mapping_id, valid as Array<{ product_id: number; quantity: number }>);
      toast.success("Mapping updated");
      setEditingId(null);
      setEditRows([]);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await productMappingsApi.remove(confirmDelete.mapping_id);
      toast.success("Mapping deleted");
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const productName = (pid: number | "") => {
    if (pid === "") return "—";
    const p = products.find(p => p.product_id === pid);
    return p ? `${p.name} (${p.sku})` : `Product #${pid}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          Product Mappings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Maps invoice product names to your catalog SKUs. Supports combo products — one invoice name can map to multiple SKUs.
          Created automatically when you approve invoices with unmapped products.
        </p>
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b">
          <Input placeholder="Search mapping name…" value={search} onChange={e => setSearch(e.target.value)} className="w-72" />
        </div>
        <div className="p-4 space-y-2">
          {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}

          {!loading && filtered.length === 0 && (
            <div className="py-12 text-center">
              <Link2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">
                {search ? "No mappings match your search" : "No mappings yet — they are created when you approve invoices with unmapped products"}
              </p>
            </div>
          )}

          {!loading && filtered.map(m => {
            const isExpanded = expandedId === m.mapping_id;
            const isEditing  = editingId === m.mapping_id;

            return (
              <div key={m.mapping_id} className="border border-border rounded-xl overflow-hidden">
                {/* Header row */}
                <div
                  className="flex items-center justify-between p-3 bg-card hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : m.mapping_id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="font-medium text-sm text-card-foreground truncate">{m.invoice_product_name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">→ {m.items.length} product{m.items.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>

                {/* Expanded items / edit mode */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/10 p-4 space-y-3">
                    {!isEditing ? (
                      // Read-only view
                      <div className="space-y-2">
                        {m.items.map(it => (
                          <div key={it.item_id} className="flex items-center gap-3 text-sm">
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                            <span className="text-card-foreground flex-1">{it.product_name ?? productName(it.product_id)}</span>
                            <span className="text-xs font-mono text-muted-foreground">{it.product_sku ?? ""}</span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">× {it.quantity}</span>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => startEdit(m)} className="mt-2">
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit Products
                        </Button>
                      </div>
                    ) : (
                      // Edit mode
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Products mapped to: <span className="text-foreground">{m.invoice_product_name}</span>
                        </p>
                        {editRows.map((row, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Select
                              value={row.product_id === "" ? "" : String(row.product_id)}
                              onValueChange={v => setEditRows(prev => prev.map((r, i) => i === idx ? { ...r, product_id: Number(v) } : r))}
                            >
                              <SelectTrigger className="flex-1 h-8 text-xs" onInteractOutside={e => e.preventDefault()}>
                                <SelectValue placeholder="Select product…" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map(p => (
                                  <SelectItem key={p.product_id} value={String(p.product_id)} className="text-xs">
                                    {p.name} ({p.sku})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-muted-foreground">×</span>
                              <Input
                                type="number" min="0.001" step="0.001"
                                value={row.quantity}
                                onChange={e => setEditRows(prev => prev.map((r, i) => i === idx ? { ...r, quantity: Number(e.target.value) } : r))}
                                className="w-16 h-8 text-xs text-center"
                              />
                            </div>
                            {editRows.length > 1 && (
                              <button onClick={() => setEditRows(prev => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive">
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => setEditRows(prev => [...prev, { product_id: "", quantity: 1 }])}
                          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />Add another product
                        </button>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={() => saveEdit(m)} disabled={saving}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete the mapping for &ldquo;{confirmDelete?.invoice_product_name}&rdquo;?
              Stock deduction for this product name will stop working on future invoices.
            </AlertDialogDescription>
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
