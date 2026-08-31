import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/api/client";
import { toast } from "sonner";
import { Receipt, Plus, Pencil, Trash2, RefreshCw, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { cn } from "@/lib/utils";

interface Expense {
  expense_id: number;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  marketplace: string;
  invoice_id?: number;
  created_at: string;
}

interface ExpenseSummary {
  total: number;
  by_category: Record<string, number>;
  count: number;
}

const EMPTY = { category: "", description: "", amount: 0, expense_date: new Date().toISOString().slice(0,10), marketplace: "none" };

// Source badge color — auto-recorded entries vs manual
const sourceBadge = (e: Expense) => {
  if (e.invoice_id) return "bg-blue-50 text-blue-600 border-blue-200";
  return "bg-gray-100 text-gray-500 border-gray-200";
};

export default function InvoiceExpenses() {
  const [items, setItems] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [listRes, sumRes] = await Promise.all([
        apiFetch<{ data: Expense[] }>("/admin/marketplace-expenses"),
        apiFetch<{ data: ExpenseSummary }>("/admin/marketplace-expenses/summary").catch(() => null),
      ]);
      setItems(listRes.data ?? []);
      setSummary(sumRes?.data ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load expenses");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const categories = useMemo(() => Array.from(new Set(items.map(e => e.category))).sort(), [items]);

  const filtered = useMemo(() => {
    const base = items.filter(e => {
      const q = search.toLowerCase();
      const mq = !q || e.category.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
      const mc = catFilter === "all" || e.category === catFilter;
      return mq && mc;
    });
    return [...base].sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const numKeys = ["total_amount", "tax_amount", "amount", "lifetime_revenue", "current_stock", "damaged_stock", "net_revenue", "salary", "balance_amount"];
      const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, search, catFilter, sortKey, sortDir]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const openCreate = () => { setEditing(null); setForm({ ...EMPTY }); setFormOpen(true); };
  const openEdit = (e: Expense) => { setEditing(e); setForm({ category: e.category, description: e.description, amount: e.amount, expense_date: e.expense_date, marketplace: e.marketplace }); setFormOpen(true); };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.category?.trim()) { toast.error("Category is required"); return; }
    if (!form.description?.trim()) { toast.error("Description is required"); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Amount must be positive"); return; }
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/admin/marketplace-expenses/${editing.expense_id}`, { method: "PUT", body: JSON.stringify(form) });
        toast.success("Expense updated");
      } else {
        await apiFetch("/admin/marketplace-expenses", { method: "POST", body: JSON.stringify(form) });
        toast.success("Expense created");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiFetch(`/admin/marketplace-expenses/${confirmDelete.expense_id}`, { method: "DELETE" });
      toast.success("Deleted");
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const totalShipping = summary?.by_category?.["Shipping"] ?? 0;
  const totalCommission = summary?.by_category?.["Marketplace Commission"] ?? 0;
  const totalInventoryLoss = summary?.by_category?.["Inventory Loss"] ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Expense</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Expenses" value={loading ? "—" : fmt(summary?.total ?? 0)} icon={Receipt} subtitleColor="muted" />
        <StatCard title="Shipping" value={loading ? "—" : fmt(totalShipping)} icon={Receipt} subtitleColor="muted" />
        <StatCard title="Commission" value={loading ? "—" : fmt(totalCommission)} icon={Receipt} subtitleColor="muted" />
        <StatCard title="Inventory Loss" value={loading ? "—" : fmt(totalInventoryLoss)} icon={Receipt} subtitleColor="muted" />
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <Input placeholder="Search category, description…" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {(sortKey !== "created_at" || sortDir !== "desc") && (
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
                  <th onClick={() => handleSort("expense_date")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Date<SortIcon col="expense_date" /></th>
                  <th onClick={() => handleSort("category")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Category<SortIcon col="category" /></th>
                  <th onClick={() => handleSort("description")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Description<SortIcon col="description" /></th>
                  <th onClick={() => handleSort("amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Amount<SortIcon col="amount" /></th>
                  <th onClick={() => handleSort("marketplace")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Platform<SortIcon col="marketplace" /></th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Source</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 7 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>)}</tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground text-sm">No expenses found</td></tr>
                )}
                {!loading && filtered.map(e => (
                  <tr key={e.expense_id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{e.expense_date}</td>
                    <td className="py-3 px-4 font-medium text-card-foreground">{e.category}</td>
                    <td className="py-3 px-4 text-card-foreground max-w-xs truncate">{e.description}</td>
                    <td className="py-3 px-4 font-medium text-red-600">{fmt(Number(e.amount))}</td>
                    <td className="py-3 px-4 capitalize text-muted-foreground">{e.marketplace === "none" ? "—" : e.marketplace}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border text-xs", sourceBadge(e))}>
                        {e.invoice_id ? "Auto" : "Manual"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)} disabled={!!e.invoice_id}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(e)} disabled={!!e.invoice_id}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
              <div className="space-y-1.5 col-span-2">
                <Label>Category *</Label>
                <CreatableCombobox optionsKey="expense_category" value={form.category} onChange={v => set("category", v)} placeholder="Select or type category…" />
              </div>
              <div className="space-y-1.5 col-span-2"><Label>Description *</Label><Input value={form.description} onChange={e => set("description", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Amount (₹) *</Label><Input type="number" value={form.amount} onChange={e => set("amount", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Date *</Label><Input type="date" value={form.expense_date} onChange={e => set("expense_date", e.target.value)} /></div>
              <div className="space-y-1.5 col-span-2">
                <Label>Marketplace</Label>
                <CreatableCombobox optionsKey="marketplace" value={form.marketplace} onChange={v => set("marketplace", v)} placeholder="Select marketplace…" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : editing ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Expense?</AlertDialogTitle><AlertDialogDescription>Permanently delete this expense record?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
