import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { marketplaceExpensesApi } from "@/lib/api/marketplaceExpenses";
import type { MarketplaceExpense, ExpenseSummary } from "@/types/marketplaceExpense";

const EMPTY: Partial<MarketplaceExpense> = { category: "", description: "", amount: 0, expense_date: "", marketplace: "none" };

export default function MarketplaceExpenses() {
  const [items, setItems] = useState<MarketplaceExpense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceExpense | null>(null);
  const [form, setForm] = useState<Partial<MarketplaceExpense>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MarketplaceExpense | null>(null);
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

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
      const [res, sumRes] = await Promise.all([
        marketplaceExpensesApi.list(),
        marketplaceExpensesApi.summary(),
      ]);
      setItems(res.data ?? []);
      setSummary(sumRes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const arr = items.filter(e =>
      !q || e.category.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
    );
    return [...arr].sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock"];
      const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, search, sortKey, sortDir]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const openCreate = () => { setEditing(null); setForm({ ...EMPTY, expense_date: new Date().toISOString().slice(0,10) }); setFormOpen(true); };
  const openEdit = (e: MarketplaceExpense) => { setEditing(e); setForm({ ...e }); setFormOpen(true); };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.category?.trim() || !form.description?.trim()) { toast.error("Category and description are required"); return; }
    if (!form.amount || form.amount <= 0) { toast.error("Amount must be positive"); return; }
    if (!form.expense_date) { toast.error("Date is required"); return; }
    setSaving(true);
    try {
      if (editing) { await marketplaceExpensesApi.update(editing.expense_id, form); toast.success("Expense updated"); }
      else { await marketplaceExpensesApi.create(form); toast.success("Expense created"); }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await marketplaceExpensesApi.remove(confirmDelete.expense_id);
      toast.success("Deleted");
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Marketplace Expenses</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Expense</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Expenses" value={summary ? `₹${summary.total.toLocaleString("en-IN")}` : "—"} subtitle="This month" icon={Receipt} subtitleColor="muted" />
        <StatCard title="Shipping" value={summary ? `₹${(summary.by_category["Shipping"] ?? 0).toLocaleString("en-IN")}` : "—"} icon={Receipt} subtitleColor="muted" />
        <StatCard title="Commission" value={summary ? `₹${(summary.by_category["Marketplace Commission"] ?? 0).toLocaleString("en-IN")}` : "—"} icon={Receipt} subtitleColor="muted" />
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex gap-3">
          <Input placeholder="Search category, description…" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
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
                  <th onClick={() => handleSort("expense_date")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">Date<SortIcon col="expense_date" /></th>
                  <th onClick={() => handleSort("category")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">Category<SortIcon col="category" /></th>
                  <th onClick={() => handleSort("description")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">Description<SortIcon col="description" /></th>
                  <th onClick={() => handleSort("amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">Amount<SortIcon col="amount" /></th>
                  <th onClick={() => handleSort("marketplace")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none">Platform<SortIcon col="marketplace" /></th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>)}</tr>
                ))}
                {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-sm">No expenses found</td></tr>}
                {!loading && filtered.map(e => (
                  <tr key={e.expense_id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground">{e.expense_date}</td>
                    <td className="py-3 px-4 font-medium text-card-foreground">{e.category}</td>
                    <td className="py-3 px-4 text-card-foreground">{e.description}</td>
                    <td className="py-3 px-4 font-medium text-card-foreground">₹{e.amount.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 capitalize text-muted-foreground">{e.marketplace === "none" ? "—" : e.marketplace}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2"><Label>Category *</Label><CreatableCombobox optionsKey="expense_category" value={form.category ?? ""} onChange={v => set("category", v)} placeholder="Select or type category…" /></div>
              <div className="space-y-1.5 col-span-2"><Label>Description *</Label><Input value={form.description ?? ""} onChange={e => set("description", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Amount (₹) *</Label><Input type="number" value={form.amount ?? 0} onChange={e => set("amount", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Date *</Label><Input type="date" value={form.expense_date ?? ""} onChange={e => set("expense_date", e.target.value)} /></div>
              <div className="space-y-1.5 col-span-2">
                <Label>Marketplace</Label>
                <CreatableCombobox optionsKey="marketplace" value={form.marketplace ?? "none"} onChange={v => set("marketplace", v)} placeholder="Select marketplace…" />
              </div>
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
          <AlertDialogHeader><AlertDialogTitle>Delete Expense?</AlertDialogTitle><AlertDialogDescription>Permanently delete this expense?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
