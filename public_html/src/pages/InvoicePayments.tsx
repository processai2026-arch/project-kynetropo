import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/api/client";
import { toast } from "sonner";
import { Wallet, Plus, RefreshCw, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { cn } from "@/lib/utils";

type SortKey = "payment_date" | "party_name" | "invoice_number" | "payment_method" | "amount" | "payment_type";
type SortDir = "asc" | "desc";

interface Payment {
  payment_id: number;
  invoice_id?: number;
  invoice_number?: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  payment_type: string;
  party_name?: string;
  notes?: string;
  created_at: string;
}

interface PaymentSummary {
  total_received: number;
  total_paid: number;
  this_month_received: number;
  count: number;
}

const typeStyles: Record<string, string> = {
  received:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  paid:      "bg-red-50 text-red-600 border-red-200",
  refund:    "bg-amber-50 text-amber-600 border-amber-200",
};

const EMPTY = { payment_date: new Date().toISOString().slice(0,10), amount: 0, payment_method: "bank_transfer", payment_type: "received", party_name: "", notes: "" };

export default function InvoicePayments() {
  const [items, setItems] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("payment_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50 ml-1 inline" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />
      : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Payment[] }>("/admin/invoice-payments");
      setItems(res.data ?? []);
      // Compute summary from data
      const received = (res.data ?? []).filter(p => p.payment_type === "received").reduce((s, p) => s + Number(p.amount), 0);
      const paid = (res.data ?? []).filter(p => p.payment_type === "paid").reduce((s, p) => s + Number(p.amount), 0);
      const thisMonth = new Date().toISOString().slice(0, 7);
      const monthReceived = (res.data ?? []).filter(p => p.payment_type === "received" && p.payment_date?.startsWith(thisMonth)).reduce((s, p) => s + Number(p.amount), 0);
      setSummary({ total_received: received, total_paid: paid, this_month_received: monthReceived, count: (res.data ?? []).length });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payments");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const f = items.filter(p => {
      const q = search.toLowerCase();
      const mq = !q || (p.party_name ?? "").toLowerCase().includes(q) || (p.invoice_number ?? "").toLowerCase().includes(q) || p.payment_method.toLowerCase().includes(q);
      const mt = typeFilter === "all" || p.payment_type === typeFilter;
      return mq && mt;
    });
    return [...f].sort((a, b) => {
      let av: string | number = a[sortKey] ?? "";
      let bv: string | number = b[sortKey] ?? "";
      if (sortKey === "amount") { av = Number(a.amount); bv = Number(b.amount); }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, search, typeFilter, sortKey, sortDir]);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { toast.error("Amount must be positive"); return; }
    if (!form.payment_date) { toast.error("Date is required"); return; }
    setSaving(true);
    try {
      await apiFetch("/admin/invoice-payments", { method: "POST", body: JSON.stringify(form) });
      toast.success("Payment recorded");
      setFormOpen(false);
      setForm({ ...EMPTY });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  };

  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          {(sortKey !== "payment_date" || sortDir !== "desc") && (
            <Button variant="outline" size="sm" onClick={() => { setSortKey("payment_date"); setSortDir("desc"); }} className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
            </Button>
          )}
          <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-2" />Record Payment</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Received" value={loading ? "—" : fmt(summary?.total_received ?? 0)} subtitle="All time" icon={Wallet} subtitleColor="primary" />
        <StatCard title="Total Paid" value={loading ? "—" : fmt(summary?.total_paid ?? 0)} subtitle="All time" icon={Wallet} subtitleColor="muted" />
        <StatCard title="This Month" value={loading ? "—" : fmt(summary?.this_month_received ?? 0)} subtitle="Received" icon={Wallet} subtitleColor="muted" />
      </div>

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <Input placeholder="Search party, invoice, method…" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="refund">Refund</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {([
                    ["Date", "payment_date"],
                    ["Party", "party_name"],
                    ["Invoice #", "invoice_number"],
                    ["Method", "payment_method"],
                    ["Amount", "amount"],
                    ["Type", "payment_type"],
                  ] as [string, SortKey][]).map(([h, key]) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none"
                      onClick={() => handleSort(key)}>
                      {h}<SortIcon col={key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>)}</tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-sm">No payments found</td></tr>
                )}
                {!loading && filtered.map(p => (
                  <tr key={p.payment_id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{p.payment_date}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.party_name ?? "—"}</td>
                    <td className="py-3 px-4 font-mono text-xs text-card-foreground">{p.invoice_number ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground capitalize">{p.payment_method.replace(/_/g, " ")}</td>
                    <td className={cn("py-3 px-4 font-medium", p.payment_type === "received" ? "text-emerald-600" : "text-red-600")}>
                      {p.payment_type === "received" ? "+" : "-"}{fmt(Number(p.amount))}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", typeStyles[p.payment_type] ?? "bg-muted text-muted-foreground")}>{p.payment_type}</Badge>
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
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Date *</Label><Input type="date" value={form.payment_date} onChange={e => set("payment_date", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Amount (₹) *</Label><Input type="number" value={form.amount} onChange={e => set("amount", Number(e.target.value))} /></div>
              <div className="space-y-1.5 col-span-2"><Label>Party Name</Label><Input value={form.party_name} onChange={e => set("party_name", e.target.value)} placeholder="Customer or vendor name" /></div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.payment_type} onValueChange={v => set("payment_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <CreatableCombobox optionsKey="payment_method" value={form.payment_method} onChange={v => set("payment_method", v)} placeholder="Select method…" />
              </div>
              <div className="space-y-1.5 col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optional notes" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Record"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
