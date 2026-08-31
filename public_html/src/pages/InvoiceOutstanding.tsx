import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, DollarSign, AlertCircle, ChevronDown, ChevronUp, History, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";

interface AgingBuckets {
  current: number;
  due_30: number;
  due_60: number;
  due_90: number;
  overdue: number;
}

interface OutstandingSummary {
  total_receivable: number;
  total_payable: number;
  overdue_90_plus: number;
  net_receivable: number;
  aging?: AgingBuckets;
}

const AGING_BUCKETS: Array<{ key: keyof AgingBuckets; label: string; color: string }> = [
  { key: "current", label: "Current (Not Due)", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { key: "due_30",  label: "1–30 Days",         color: "text-blue-700 bg-blue-50 border-blue-200" },
  { key: "due_60",  label: "31–60 Days",         color: "text-amber-700 bg-amber-50 border-amber-200" },
  { key: "due_90",  label: "61–90 Days",         color: "text-orange-700 bg-orange-50 border-orange-200" },
  { key: "overdue", label: "90+ Days",           color: "text-red-700 bg-red-50 border-red-200" },
];

interface OutstandingEntry {
  id: number;
  party_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  balance_amount: number;
  aging_bucket: string;
}

const PAYMENT_METHODS = ["bank_transfer", "upi", "cheque", "cash", "neft", "rtgs"];

const agingBadge: Record<string, string> = {
  current: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "1-30": "bg-blue-50 text-blue-600 border-blue-200",
  "31-60": "bg-amber-50 text-amber-600 border-amber-200",
  "61-90": "bg-orange-50 text-orange-600 border-orange-200",
  "90+": "bg-red-50 text-red-600 border-red-200",
};

export default function InvoiceOutstanding() {
  const [tab, setTab] = useState<"summary" | "receivables" | "payables">("summary");
  const [summary, setSummary] = useState<OutstandingSummary | null>(null);
  const [receivables, setReceivables] = useState<OutstandingEntry[]>([]);
  const [payables, setPayables] = useState<OutstandingEntry[]>([]);
  const [loadingSum, setLoadingSum] = useState(true);
  const [loadingRec, setLoadingRec] = useState(true);
  const [loadingPay, setLoadingPay] = useState(true);
  const [apiNotReady, setApiNotReady] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<OutstandingEntry | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", payment_method: "bank_transfer", payment_date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  // Payment history expand
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<Record<number, Array<{ payment_id: number; amount: number; payment_method: string; payment_date: string; notes: string }>>>({});

  const loadPaymentHistory = async (entryId: number) => {
    if (expandedId === entryId) { setExpandedId(null); return; }
    setExpandedId(entryId);
    if (paymentHistory[entryId]) return;
    try {
      const res = await apiFetch<{ data: { payments: Array<{ payment_id: number; amount: number; payment_method: string; payment_date: string; notes: string }> } }>(`/admin/outstanding/${entryId}/payments`);
      setPaymentHistory(prev => ({ ...prev, [entryId]: res.data?.payments ?? [] }));
    } catch { /* silent */ }
  };

  const loadSummary = async () => {
    setLoadingSum(true);
    try {
      const res = await apiFetch<{ data: OutstandingSummary }>("/admin/outstanding/summary");
      setSummary(res.data ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("404") || msg.includes("not found") || msg.toLowerCase().includes("api 404")) {
        setApiNotReady(true);
      }
    } finally {
      setLoadingSum(false);
    }
  };

  const loadReceivables = async () => {
    setLoadingRec(true);
    try {
      const res = await apiFetch<{ data: OutstandingEntry[] }>("/admin/outstanding/receivables");
      setReceivables(res.data ?? []);
    } catch {
      setReceivables([]);
    } finally {
      setLoadingRec(false);
    }
  };

  const loadPayables = async () => {
    setLoadingPay(true);
    try {
      const res = await apiFetch<{ data: OutstandingEntry[] }>("/admin/outstanding/payables");
      setPayables(res.data ?? []);
    } catch {
      setPayables([]);
    } finally {
      setLoadingPay(false);
    }
  };

  useEffect(() => {
    loadSummary();
    loadReceivables();
    loadPayables();
  }, []);

  const openPayment = (entry: OutstandingEntry) => {
    setPaymentTarget(entry);
    setPayForm({ amount: String(entry.balance_amount), payment_method: "bank_transfer", payment_date: new Date().toISOString().slice(0, 10), notes: "" });
    setPaymentOpen(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget) return;
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await apiFetch(`/admin/outstanding/${paymentTarget.id}/payment`, {
        method: "POST",
        body: JSON.stringify(payForm),
      });
      toast.success("Payment recorded");
      setPaymentOpen(false);
      loadReceivables();
      loadPayables();
      loadSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) =>
    "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const NotReadyBanner = () => (
    <div className="flex items-start gap-3 bg-muted/50 rounded-xl border p-6 text-sm text-muted-foreground">
      <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="font-medium text-foreground mb-1">Outstanding tracking not yet active</p>
        <p>Outstanding tracking will be active once invoices with credit terms are approved. Upload and approve purchase or sales invoices with credit terms to populate this section.</p>
      </div>
    </div>
  );

  const [sortKey, setSortKey] = useState<string>("invoice_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const resetSort = () => { setSortKey("invoice_date"); setSortDir("desc"); };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" /> : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };

  const sortData = (data: OutstandingEntry[]) => {
    const numKeys = ["total_amount", "balance_amount"];
    return [...data].sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

  const OutstandingTable = ({ data, loading: tableLoading, type }: { data: OutstandingEntry[]; loading: boolean; type: "receivable" | "payable" }) => {
    const sorted = sortData(data);
    return (
    <div className="overflow-x-auto eco-float-scroll">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th onClick={() => handleSort("party_name")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              {type === "receivable" ? "Customer" : "Vendor"}<SortIcon col="party_name" />
            </th>
            <th onClick={() => handleSort("invoice_number")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              Invoice #<SortIcon col="invoice_number" />
            </th>
            <th onClick={() => handleSort("invoice_date")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              Date<SortIcon col="invoice_date" />
            </th>
            <th onClick={() => handleSort("due_date")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              Due Date<SortIcon col="due_date" />
            </th>
            <th onClick={() => handleSort("total_amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              Total<SortIcon col="total_amount" />
            </th>
            <th onClick={() => handleSort("balance_amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              Balance<SortIcon col="balance_amount" />
            </th>
            <th onClick={() => handleSort("aging_bucket")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">
              Status<SortIcon col="aging_bucket" />
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"></th>
          </tr>
        </thead>
        <tbody>
          {tableLoading && Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="border-b">
              {Array.from({ length: 8 }).map((__, j) => (
                <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
              ))}
            </tr>
          ))}
          {!tableLoading && sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-sm">No {type === "receivable" ? "receivables" : "payables"} found</td>
            </tr>
          )}
          {!tableLoading && sorted.map((entry) => (
            <>
              <tr key={entry.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="py-3 px-4 text-card-foreground font-medium">{entry.party_name}</td>
                <td className="py-3 px-4 text-card-foreground font-mono text-xs">{entry.invoice_number}</td>
                <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{entry.invoice_date}</td>
                <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{entry.due_date}</td>
                <td className="py-3 px-4 text-card-foreground text-right">{fmt(Number(entry.total_amount))}</td>
                <td className="py-3 px-4 text-card-foreground text-right font-medium">{fmt(Number(entry.balance_amount))}</td>
                <td className="py-3 px-4">
                  <Badge className={cn("border capitalize", agingBadge[entry.aging_bucket] ?? "bg-muted text-muted-foreground")}>
                    {entry.aging_bucket === "current" ? "Current" : `${entry.aging_bucket} days`}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    {Number(entry.balance_amount) > 0 && (
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => openPayment(entry)}>+ Payment</Button>
                    )}
                    <button onClick={() => loadPaymentHistory(entry.id)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Payment history">
                      {expandedId === entry.id ? <ChevronUp className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </td>
              </tr>
              {expandedId === entry.id && (
                <tr key={`${entry.id}-history`} className="bg-muted/20">
                  <td colSpan={8} className="px-6 py-3 border-b">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment History</p>
                    {!(paymentHistory[entry.id]) ? (
                      <p className="text-xs text-muted-foreground italic">Loading…</p>
                    ) : paymentHistory[entry.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No payments recorded yet</p>
                    ) : (
                      <div className="space-y-1">
                        {paymentHistory[entry.id].map((p) => (
                          <div key={p.payment_id} className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="font-mono font-semibold text-emerald-600">+{fmt(p.amount)}</span>
                            <span>{p.payment_date}</span>
                            <span className="capitalize">{(p.payment_method ?? "").replace("_", " ")}</span>
                            {p.notes && <span className="italic">"{p.notes}"</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Outstanding</h1>
        <div className="flex items-center gap-2">
          {sortKey !== "invoice_date" && (
            <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
            </Button>
          )}
        </div>
      </div>

      {!loadingSum && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Receivable" value={fmt(summary?.total_receivable ?? 0)} subtitle="Customers owe you" icon={DollarSign} subtitleColor="primary" />
          <StatCard title="Total Payable" value={fmt(summary?.total_payable ?? 0)} subtitle="You owe vendors" icon={DollarSign} subtitleColor="muted" />
          <StatCard title="Overdue 90+ Days" value={fmt(summary?.overdue_90_plus ?? 0)} subtitle="Critical aging" icon={AlertCircle} subtitleColor="muted" />
          <StatCard title="Net Receivable" value={fmt(summary?.net_receivable ?? 0)} subtitle="Receivable minus payable" icon={DollarSign} subtitleColor="primary" />
        </div>
      )}

      {!loadingSum && summary?.aging && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <p className="text-sm font-semibold text-card-foreground mb-4">Aging Analysis — Receivables</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {AGING_BUCKETS.map(bucket => (
              <div key={bucket.key} className={cn("rounded-lg border px-3 py-3 text-center", bucket.color)}>
                <p className="text-xs font-medium mb-1">{bucket.label}</p>
                <p className="text-base font-bold font-mono">{fmt(summary.aging![bucket.key] ?? 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="flex gap-1 p-4 border-b">
          {(["summary", "receivables", "payables"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "summary" && (
            apiNotReady ? <NotReadyBanner /> : (
              loadingSum ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>Use the <strong className="text-foreground">Receivables</strong> and <strong className="text-foreground">Payables</strong> tabs to view detailed outstanding entries and record payments.</p>
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Receivable</p>
                      <p className="text-lg font-bold text-foreground">{fmt(summary?.total_receivable ?? 0)}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Payable</p>
                      <p className="text-lg font-bold text-foreground">{fmt(summary?.total_payable ?? 0)}</p>
                    </div>
                  </div>
                </div>
              )
            )
          )}
          {tab === "receivables" && (
            apiNotReady ? <NotReadyBanner /> : <OutstandingTable data={receivables} loading={loadingRec} type="receivable" />
          )}
          {tab === "payables" && (
            apiNotReady ? <NotReadyBanner /> : <OutstandingTable data={payables} loading={loadingPay} type="payable" />
          )}
        </div>
      </div>

      <Dialog open={paymentOpen} onOpenChange={(v) => { if (!saving) setPaymentOpen(v); }}>
        <DialogContent onInteractOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Record Payment — {paymentTarget?.party_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
                <Button type="button" variant="outline" onClick={() => setPayForm((f) => ({ ...f, amount: String(paymentTarget?.balance_amount ?? 0) }))}>
                  Full
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <CreatableCombobox
                optionsKey="payment_method"
                value={payForm.payment_method}
                onChange={(v) => setPayForm((f) => ({ ...f, payment_method: v }))}
                placeholder="Select method…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input type="date" value={payForm.payment_date} onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional reference or notes" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Record Payment"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)} disabled={saving}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
