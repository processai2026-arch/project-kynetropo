import { useEffect, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { opsFinanceApi, opsClientsApi, opsProjectsApi } from "@/lib/api/ops";
import type { OpsPayment, OpsExpense, OpsFinanceSummary, OpsClient, OpsProject } from "@/types/ops";
import { IndianRupee, Plus, Trash2, TrendingUp, TrendingDown, Wallet, Clock } from "lucide-react";
import { toast } from "sonner";

const EMPTY_PAY = { client_id: 0, project_id: 0, amount: 0, type: "advance", mode: "bank_transfer", reference: "", payment_date: "", notes: "" };
const EMPTY_EXP = { category: "other", amount: 0, description: "", project_id: undefined as number | undefined, date: "", added_by: "" };

const payStatusStyles: Record<string, string> = {
  paid:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-600 border-amber-200",
  pending: "bg-gray-100 text-gray-500 border-gray-200",
  overdue: "bg-red-50 text-red-600 border-red-200",
};

export default function Finance() {
  const [summary, setSummary]   = useState<OpsFinanceSummary | null>(null);
  const [payments, setPayments] = useState<OpsPayment[]>([]);
  const [expenses, setExpenses] = useState<OpsExpense[]>([]);
  const [clients, setClients]   = useState<OpsClient[]>([]);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<"summary"|"payments"|"expenses"|"pl">("summary");
  const [month, setMonth]       = useState(new Date().toISOString().slice(0,7));
  const [payOpen, setPayOpen]   = useState(false);
  const [payForm, setPayForm]   = useState(EMPTY_PAY);
  const [payingSaving, setPayingSaving] = useState(false);
  const [expOpen, setExpOpen]   = useState(false);
  const [expForm, setExpForm]   = useState(EMPTY_EXP);
  const [expSaving, setExpSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sumRes, payRes, expRes] = await Promise.all([
        opsFinanceApi.summary({ month }),
        opsFinanceApi.payments({ month }),
        opsFinanceApi.expenses({ month }),
      ]);
      setSummary((sumRes as any).data);
      setPayments((payRes as any).data ?? []);
      setExpenses((expRes as any).data ?? []);
    } catch { toast.error("Failed to load finance data"); }
    finally  { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, [month]);
  useEffect(() => {
    opsClientsApi.list().then(r => setClients((r as any).data ?? [])).catch(() => {});
    opsProjectsApi.list().then(r => setProjects((r as any).data ?? [])).catch(() => {});
  }, []);

  const clientProjects = payForm.client_id ? projects.filter(p => p.client_id === payForm.client_id) : projects;

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.client_id || !payForm.project_id) { toast.error("Client and project required"); return; }
    if (payForm.amount <= 0) { toast.error("Amount required"); return; }
    setPayingSaving(true);
    try {
      await opsFinanceApi.addPayment({ ...payForm, payment_date: payForm.payment_date || new Date().toISOString().split("T")[0] });
      toast.success("Payment recorded"); setPayOpen(false); loadAll();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally       { setPayingSaving(false); }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expForm.amount <= 0) { toast.error("Amount required"); return; }
    setExpSaving(true);
    try {
      await opsFinanceApi.addExpense({ ...expForm, date: expForm.date || new Date().toISOString().split("T")[0] });
      toast.success("Expense recorded"); setExpOpen(false); loadAll();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally       { setExpSaving(false); }
  };

  const handleDeletePayment = async (id: number) => {
    if (!confirm("Delete this payment? Project balance will be reversed.")) return;
    try { await opsFinanceApi.deletePayment(id); toast.success("Deleted"); loadAll(); }
    catch { toast.error("Failed"); }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm("Delete this expense?")) return;
    try { await opsFinanceApi.deleteExpense(id); toast.success("Deleted"); loadAll(); }
    catch { toast.error("Failed"); }
  };

  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Finance</h1>
        <div className="flex gap-2 items-center">
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-[160px]" />
          <Button onClick={() => setPayOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Payment</Button>
          <Button variant="outline" onClick={() => setExpOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Expense</Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border shadow-sm p-5"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-16" /></div>
        )) : <>
          <StatCard title="All-time Revenue"   value={fmt(summary?.total_revenue_all_time ?? 0)}  icon={TrendingUp}    subtitleColor="primary" />
          <StatCard title="This Month Revenue" value={fmt(summary?.total_revenue_month ?? 0)}     icon={IndianRupee}   subtitleColor="primary" />
          <StatCard title="Collected Month"    value={fmt(summary?.total_collected_month ?? 0)}   icon={Wallet}        subtitleColor="primary" />
          <StatCard title="Total Pending"      value={fmt(summary?.total_pending ?? 0)}           icon={Clock}         subtitleColor="muted" />
          <StatCard title="Expenses Month"     value={fmt(summary?.total_expenses_month ?? 0)}    icon={TrendingDown}  subtitleColor="muted" />
          <StatCard title="Net Profit Month"   value={fmt(summary?.net_profit_month ?? 0)}        icon={TrendingUp}
            subtitleColor={(summary?.net_profit_month ?? 0) >= 0 ? "primary" : "muted"} />
        </>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit">
        {(["summary","payments","expenses","pl"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("px-4 py-1.5 text-xs font-medium rounded-md capitalize transition-colors",
              activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {tab === "pl" ? "P&L" : tab}
          </button>
        ))}
      </div>

      {/* Revenue by project summary */}
      {activeTab === "summary" && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b"><h2 className="text-base font-semibold text-card-foreground">Revenue by Project</h2></div>
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Project","Client","Quoted","Received","Balance","Status","% Collected"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">{Array.from({ length: 7 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
                  ))}
                  {!loading && (summary?.by_project ?? []).length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">No projects</td></tr>
                  )}
                  {!loading && (summary?.by_project ?? []).map(p => (
                    <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-card-foreground">{p.name}</td>
                      <td className="py-3 px-4 text-card-foreground">{p.client_name}</td>
                      <td className="py-3 px-4 text-card-foreground">{fmt(p.quoted)}</td>
                      <td className="py-3 px-4 text-emerald-700 font-medium">{fmt(p.received)}</td>
                      <td className="py-3 px-4 text-red-600 font-medium">{fmt(p.balance)}</td>
                      <td className="py-3 px-4">
                        <Badge className={cn("border capitalize text-xs", payStatusStyles[p.payment_status] ?? "bg-muted text-muted-foreground")}>
                          {p.payment_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-card-foreground">{p.pct_collected}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payments tab */}
      {activeTab === "payments" && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b"><h2 className="text-base font-semibold text-card-foreground">Payment Log — {month}</h2></div>
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Date","Client","Project","Amount","Type","Mode","Reference","Recorded By",""].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">{Array.from({ length: 9 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
                  ))}
                  {!loading && payments.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-muted-foreground text-sm">No payments this month</td></tr>
                  )}
                  {!loading && payments.map(p => (
                    <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-card-foreground">{p.payment_date}</td>
                      <td className="py-3 px-4 text-card-foreground">{(p as any).client_name ?? "—"}</td>
                      <td className="py-3 px-4 text-card-foreground">{(p as any).project_name ?? "—"}</td>
                      <td className="py-3 px-4 font-medium text-emerald-700">{fmt(p.amount)}</td>
                      <td className="py-3 px-4 capitalize text-card-foreground">{p.type}</td>
                      <td className="py-3 px-4 capitalize text-card-foreground">{p.mode.replace("_"," ")}</td>
                      <td className="py-3 px-4 text-card-foreground">{p.reference ?? "—"}</td>
                      <td className="py-3 px-4 text-card-foreground">{p.recorded_by || "—"}</td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="icon" onClick={() => handleDeletePayment(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Expenses tab */}
      {activeTab === "expenses" && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b"><h2 className="text-base font-semibold text-card-foreground">Expense Log — {month}</h2></div>
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Date","Category","Description","Amount","Project","Added By",""].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">{Array.from({ length: 7 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
                  ))}
                  {!loading && expenses.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">No expenses this month</td></tr>
                  )}
                  {!loading && expenses.map(e => (
                    <tr key={e.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-card-foreground">{e.date}</td>
                      <td className="py-3 px-4 capitalize text-card-foreground">{e.category}</td>
                      <td className="py-3 px-4 text-card-foreground">{e.description || "—"}</td>
                      <td className="py-3 px-4 font-medium text-red-600">{fmt(e.amount)}</td>
                      <td className="py-3 px-4 text-card-foreground">{(e as any).project_name ?? "—"}</td>
                      <td className="py-3 px-4 text-card-foreground">{e.added_by || "—"}</td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* P&L tab */}
      {activeTab === "pl" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Revenue", value: summary?.total_revenue_month ?? 0, color: "text-emerald-700" },
            { label: "Total Expenses", value: summary?.total_expenses_month ?? 0, color: "text-red-600" },
            { label: "Net Profit", value: summary?.net_profit_month ?? 0, color: (summary?.net_profit_month ?? 0) >= 0 ? "text-emerald-700" : "text-red-600" },
          ].map(item => (
            <div key={item.label} className="bg-card rounded-xl border shadow-sm p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">{item.label}</p>
              <p className={cn("text-3xl font-bold", item.color)}>{fmt(item.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={v => { if (!payingSaving) setPayOpen(v); }}>
        <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Client *</Label>
                <Select value={String(payForm.client_id || "")} onValueChange={v => setPayForm(f => ({ ...f, client_id: Number(v), project_id: 0 }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Project *</Label>
                <Select value={String(payForm.project_id || "")} onValueChange={v => setPayForm(f => ({ ...f, project_id: Number(v) }))}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {clientProjects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input type="number" value={payForm.amount || ""} onChange={e => setPayForm(f => ({ ...f, amount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={payForm.type} onValueChange={v => setPayForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["advance","mid","final","amc","other"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select value={payForm.mode} onValueChange={v => setPayForm(f => ({ ...f, mode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["cash","bank_transfer","upi","cheque","other"].map(m => <SelectItem key={m} value={m}>{m.replace("_"," ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Reference</Label>
                <Input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="UTR / cheque no." />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)} disabled={payingSaving}>Cancel</Button>
              <Button type="submit" disabled={payingSaving}>{payingSaving ? "Saving…" : "Record Payment"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={expOpen} onOpenChange={v => { if (!expSaving) setExpOpen(v); }}>
        <DialogContent className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={expForm.category} onValueChange={v => setExpForm(f => ({ ...f, category: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["hosting","tools","travel","marketing","salary","pitch","other"].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount *</Label>
                <Input type="number" value={expForm.amount || ""} onChange={e => setExpForm(f => ({ ...f, amount: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={expForm.date} onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Project (optional)</Label>
                <Select value={String(expForm.project_id ?? "")} onValueChange={v => setExpForm(f => ({ ...f, project_id: v ? Number(v) : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Description</Label>
                <Textarea value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Added By</Label>
                <Input value={expForm.added_by} onChange={e => setExpForm(f => ({ ...f, added_by: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setExpOpen(false)} disabled={expSaving}>Cancel</Button>
              <Button type="submit" disabled={expSaving}>{expSaving ? "Saving…" : "Add Expense"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
