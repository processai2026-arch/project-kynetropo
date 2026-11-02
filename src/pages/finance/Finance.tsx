import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { RecordListPage } from "@/components/RecordListPage";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { opsFinanceApi, opsProjectsApi } from "@/lib/api/ops";
import { formatDate } from "@/lib/format";
import { rowOpenProps, ROW_OPEN_CLASS } from "@/lib/rowNav";
import type { OpsPayment, OpsExpense, OpsFinanceSummary, OpsProject, OpsOtherIncome } from "@/types/ops";
import { IndianRupee, Plus, Receipt, Scale, ShieldCheck, TrendingUp, TrendingDown, Wallet, Clock } from "lucide-react";
import { toast } from "sonner";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { usePagedRows } from "@/hooks/usePagedRows";
import { PaymentDialog } from "@/pages/crm/components/PaymentDialog";
import { OtherIncomeDialog } from "./components/OtherIncomeDialog";

const payStatusStyles: Record<string, string> = {
  paid:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-600 border-amber-200",
  pending: "bg-gray-100 text-gray-500 border-gray-200",
  overdue: "bg-red-50 text-red-600 border-red-200",
};

const TABS = ["summary", "payments", "other"] as const;
const TAB_LABEL: Record<Tab, string> = { summary: "By project", payments: "Payments", other: "Other income" };
type Tab = typeof TABS[number];

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap", right ? "text-right" : "text-left")}>{children}</th>
);

export default function Finance() {
  const navigate = useNavigate();
  // The tab and month live in the address, so coming back from a payment or
  // expense lands on the same tab and month.
  const [params, setParams] = useSearchParams();
  const activeTab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? params.get("tab") as Tab : "summary";
  // Expenses and P&L have their own pages now; an old ?tab= link goes there.
  useEffect(() => {
    if (params.get("tab") === "expenses") navigate("/finance/expenses", { replace: true });
    if (params.get("tab") === "pl") navigate("/finance/profit-loss", { replace: true });
  }, [params, navigate]);
  const month = params.get("month") || new Date().toISOString().slice(0, 7);
  const setParam = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); n.set(k, v); return n; }, { replace: true });

  const [summary, setSummary]   = useState<OpsFinanceSummary | null>(null);
  const [payments, setPayments] = useState<OpsPayment[]>([]);
  const [expenses, setExpenses] = useState<OpsExpense[]>([]);
  const pagedPayments = usePagedRows(payments, "payments");
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [payOpen, setPayOpen]   = useState(false);
  const [other, setOther]       = useState<OpsOtherIncome[]>([]);
  // The other income being added (null) or changed; undefined when the window is shut.
  const [otherEdit, setOtherEdit] = useState<OpsOtherIncome | null | undefined>(undefined);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, payRes, expRes, otherRes] = await Promise.all([
        opsFinanceApi.summary({ month }),
        opsFinanceApi.payments({ month }),
        opsFinanceApi.expenses({ month }),
        opsFinanceApi.otherIncome(),
      ]);
      setSummary(sumRes.data);
      setPayments(payRes.data ?? []);
      setExpenses(expRes.data ?? []);
      setOther(otherRes.data ?? []);
    } catch { toast.error("Failed to load finance data"); }
    finally  { setLoading(false); }
  }, [month]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    opsProjectsApi.list().then(r => setProjects(r.data ?? [])).catch(() => {});
  }, []);

  const fmt = (n: number | null | undefined) => "₹" + Number(n ?? 0).toLocaleString("en-IN");
  const monthName = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const monthShort = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  return (
    <RecordListPage>
      <PageHeader
        title="Income"
        subtitle="Money in — project payments, AMC and other income — with the month's profit"
        action={
          <div className="flex gap-2 items-center flex-wrap">
            <Input type="month" value={month} onChange={e => e.target.value && setParam("month", e.target.value)} className="w-[160px]" aria-label="Month" />
            <Button onClick={() => setPayOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Payment</Button>
            <Button variant="outline" onClick={() => navigate("/finance/expenses")}><Receipt className="h-4 w-4 mr-2" />Expenses</Button>
            <Button variant="outline" onClick={() => navigate("/finance/profit-loss")}><Scale className="h-4 w-4 mr-2" />Profit &amp; Loss</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border shadow-sm p-5"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-16" /></div>
        )) : <>
          <StatCard title="Collected" value={fmt(summary?.total_collected_month)}
            subtitle={`Projects ${fmt(summary?.project_collected_month)} · AMC ${fmt(summary?.amc_collected_month)}${summary?.other_income_month ? ` · Other ${fmt(summary.other_income_month)}` : ""}`} icon={Wallet} subtitleColor="muted" />
          <StatCard title="Expenses" value={fmt(summary?.total_expenses_month)} subtitle={`${expenses.length} in ${monthShort}`} icon={TrendingDown} accent="rose" subtitleColor="muted" />
          <StatCard title="Net profit" value={fmt(summary?.net_profit_month)} subtitle={`${monthShort}: in − out`} icon={TrendingUp}
            accent={(summary?.net_profit_month ?? 0) >= 0 ? "emerald" : "rose"} subtitleColor="muted" />
          <StatCard title="Projects due" value={fmt(summary?.total_pending)} subtitle="Still to collect on projects" icon={Clock} accent="amber" subtitleColor="muted" />
          <StatCard title="AMC due" value={fmt(summary?.amc_due)} subtitle="Within 30 days or overdue" icon={ShieldCheck} accent="violet" subtitleColor="muted" />
          <StatCard title="All time" value={fmt(summary?.total_revenue_all_time)} subtitle="Every payment and other income" icon={IndianRupee} accent="teal" subtitleColor="muted" />
        </>}
      </div>

      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setParam("tab", tab)}
            className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-colors",
              activeTab === tab ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {activeTab === "summary" && (
        <Panel title="Money by project" subtitle="Every project — open one to see its payments, AMC and expenses" flush>
          <ScrollableX>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <Th>Project</Th><Th>Client</Th><Th right>Quoted</Th><Th right>Received</Th><Th right>Balance</Th>
                  <Th>Status</Th><Th right>AMC a year</Th><Th>AMC next due</Th><Th right>Spent</Th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 9 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
                ))}
                {!loading && (summary?.by_project ?? []).length === 0 && (
                  <tr><td colSpan={9} className="py-8 text-center text-muted-foreground text-sm">No projects</td></tr>
                )}
                {!loading && (summary?.by_project ?? []).map(p => (
                  <tr key={p.id} className={cn("border-b hover:bg-muted/30 transition-colors", ROW_OPEN_CLASS)} {...rowOpenProps(() => navigate(`/finance/projects/${p.id}`))}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-card-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{[p.project_code, p.stage].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="py-3 px-4 text-card-foreground">{p.client_name ?? "—"}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-card-foreground">{fmt(p.quoted)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-emerald-700 font-medium">
                      {fmt(p.received)} <span className="text-xs font-normal text-muted-foreground">{p.pct_collected}%</span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-red-600 font-medium">{fmt(p.balance)}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize text-xs", payStatusStyles[p.payment_status] ?? "bg-muted text-muted-foreground")}>
                        {p.payment_status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-card-foreground">{p.amc_per_year ? fmt(p.amc_per_year) : "—"}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {p.amc_next_due ? <span className={cn((p.amc_due ?? 0) > 0 ? "text-amber-700 font-medium" : "text-card-foreground")}>{formatDate(p.amc_next_due)}</span> : "—"}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-card-foreground">{p.expenses ? fmt(p.expenses) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableX>
        </Panel>
      )}

      {activeTab === "payments" && (
        <Panel title={`Payments — ${monthName}`} subtitle="Open a payment to see it, change it or delete it" flush>
          <ScrollableX>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <Th>Date</Th><Th>Client</Th><Th>Project</Th><Th right>Amount</Th><Th>For</Th><Th>Mode</Th><Th>Reference</Th><Th>Recorded by</Th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 8 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
                ))}
                {!loading && payments.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">No payments in {monthName}</td></tr>
                )}
                {!loading && pagedPayments.rows.map(p => (
                  <tr key={p.id} className={cn("border-b hover:bg-muted/30 transition-colors", ROW_OPEN_CLASS)} {...rowOpenProps(() => navigate(`/finance/payments/${p.id}`))}>
                    <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{formatDate(p.payment_date)}</td>
                    <td className="py-3 px-4 text-card-foreground">
                      {p.client_code && <span className="mr-1 font-mono text-xs text-muted-foreground">{p.client_code}</span>}{p.client_name ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-card-foreground">
                      {p.project_code && <span className="mr-1 font-mono text-xs text-muted-foreground">{p.project_code}</span>}{p.project_name ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-700">{fmt(p.amount)}</td>
                    <td className="py-3 px-4">
                      {p.type === "amc" ? <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">AMC</Badge> : <span className="capitalize text-card-foreground">{p.type}</span>}
                    </td>
                    <td className="py-3 px-4 capitalize text-card-foreground">{p.mode.replace("_"," ")}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.reference || "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{p.recorded_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableX>
          {pagedPayments.bar}
        </Panel>
      )}

      {activeTab === "other" && (
        <Panel title={`Other income — ${other.length} · ${fmt(other.reduce((s, o) => s + Number(o.amount), 0))}`}
          subtitle="Money in that is not a client's payment: a hackathon prize, a grant. Open one to change or delete it."
          actions={<Button size="sm" onClick={() => setOtherEdit(null)}><Plus className="h-4 w-4 mr-1" />Add income</Button>} flush>
          <ScrollableX>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50"><Th>Date</Th><Th>From</Th><Th right>Amount</Th><Th>Notes</Th><Th>Added by</Th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="p-4"><Skeleton className="h-4 w-full" /></td></tr>}
                {!loading && other.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">No other income yet</td></tr>
                )}
                {!loading && other.map(o => (
                  <tr key={o.id} className={cn("border-b hover:bg-muted/30 transition-colors", ROW_OPEN_CLASS, o.date.startsWith(month) && "bg-primary/5")}
                    {...rowOpenProps(() => setOtherEdit(o))}>
                    <td className="py-3 px-4 text-card-foreground whitespace-nowrap">{formatDate(o.date)}</td>
                    <td className="py-3 px-4 font-medium text-card-foreground">{o.source}</td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-emerald-700">{fmt(o.amount)}</td>
                    <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">{o.notes || "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">{o.added_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableX>
        </Panel>
      )}

      <OtherIncomeDialog income={otherEdit} onOpenChange={(v) => { if (!v) setOtherEdit(undefined); }} onSaved={() => void loadAll()} />

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen}
        projects={projects.map((p) => ({ id: p.id, client_id: p.client_id, name: `${p.name}${p.client_name ? ` — ${p.client_name}` : ""}`, project_code: p.project_code, balance: p.balance }))}
        onSaved={() => void loadAll()} />
    </RecordListPage>
  );
}
