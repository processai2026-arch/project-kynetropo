import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IndianRupee, RefreshCcw, Scale, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { RecordListPage } from "@/components/RecordListPage";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { opsFinanceApi } from "@/lib/api/ops";
import { rowOpenProps, ROW_OPEN_CLASS } from "@/lib/rowNav";
import { cn } from "@/lib/utils";
import type { OpsExpense, OpsOtherIncome, OpsPayment } from "@/types/ops";
import { categoryLabel, monthLabel } from "./components/ExpenseBits";

/*
 * Profit & loss: money in (project payments, AMC, other income) less money out
 * (expenses), month by month. Everything comes from what is recorded under
 * Income, AMC and Expenses — nothing is typed here.
 */

const ALL = "all";
const fmt = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");
const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap", right ? "text-right" : "text-left")}>{children}</th>
);
const Td = ({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) => (
  <td className={cn("py-2.5 px-4 tabular-nums", right && "text-right", className)}>{children}</td>
);
const profitClass = (n: number) => (n >= 0 ? "text-emerald-700" : "text-red-600");

/** Indian financial year of a date: "2026-05-01" → 2026 (Apr 2026 – Mar 2027). */
const fyOf = (date: string) => { const y = Number(date.slice(0, 4)); return Number(date.slice(5, 7)) >= 4 ? y : y - 1; };
const fyLabel = (y: number) => `FY ${y}–${String(y + 1).slice(2)}`;

interface Month { month: string; project: number; amc: number; other: number; income: number; spent: number; profit: number }

function useMoney() {
  const [payments, setPayments] = useState<OpsPayment[]>([]);
  const [expenses, setExpenses] = useState<OpsExpense[]>([]);
  const [other, setOther] = useState<OpsOtherIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, e, o] = await Promise.all([opsFinanceApi.payments(), opsFinanceApi.expenses(), opsFinanceApi.otherIncome()]);
      setPayments(p.data ?? []);
      setExpenses(e.data ?? []);
      setOther(o.data ?? []);
    } catch { toast.error("Could not load the money"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { payments, expenses, other, loading };
}

export default function ProfitLoss() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // "all", a financial year ("fy2026") or a month ("2026-10").
  const period = params.get("period") ?? ALL;
  const setPeriod = (v: string) => setParams((p) => { const n = new URLSearchParams(p); n.set("period", v); return n; }, { replace: true });
  const { payments, expenses, other, loading } = useMoney();

  const inPeriod = useCallback((date: string) =>
    period === ALL || (period.startsWith("fy") ? fyOf(date) === Number(period.slice(2)) : date.startsWith(period)), [period]);

  const allMonths = useMemo(() => {
    const m = new Map<string, Month>();
    const at = (k: string) => m.get(k) ?? { month: k, project: 0, amc: 0, other: 0, income: 0, spent: 0, profit: 0 };
    for (const p of payments) {
      const v = at(p.payment_date.slice(0, 7));
      if (p.type === "amc") v.amc += Number(p.amount); else v.project += Number(p.amount);
      m.set(v.month, v);
    }
    for (const o of other) {
      const v = at(o.date.slice(0, 7));
      v.other += Number(o.amount);
      m.set(v.month, v);
    }
    for (const e of expenses) {
      const v = at(e.date.slice(0, 7));
      v.spent += Number(e.amount);
      m.set(v.month, v);
    }
    return [...m.values()]
      .map((v) => ({ ...v, income: v.project + v.amc + v.other, profit: v.project + v.amc + v.other - v.spent }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [payments, expenses, other]);

  const years = useMemo(() => [...new Set(allMonths.map((m) => fyOf(`${m.month}-01`)))].sort((a, b) => b - a), [allMonths]);
  const months = useMemo(() => allMonths.filter((m) => inPeriod(`${m.month}-01`)), [allMonths, inPeriod]);
  const t = useMemo(() => months.reduce(
    (s, m) => ({ project: s.project + m.project, amc: s.amc + m.amc, other: s.other + m.other, income: s.income + m.income, spent: s.spent + m.spent, profit: s.profit + m.profit }),
    { project: 0, amc: 0, other: 0, income: 0, spent: 0, profit: 0 }), [months]);

  // Running profit, oldest month first, so each row shows where the business stood.
  const running = useMemo(() => {
    const r = new Map<string, number>();
    let sum = 0;
    for (const m of [...months].reverse()) { sum += m.profit; r.set(m.month, sum); }
    return r;
  }, [months]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) if (inPeriod(e.date)) m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, inPeriod]);
  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payments) {
      if (!inPeriod(p.payment_date)) continue;
      const k = p.type === "amc" ? "AMC" : (p.project_name ?? p.client_name ?? "Other");
      m.set(k, (m.get(k) ?? 0) + Number(p.amount));
    }
    for (const o of other) if (inPeriod(o.date)) m.set(o.source, (m.get(o.source) ?? 0) + Number(o.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [payments, other, inPeriod]);

  const periodLabel = period === ALL ? "All time" : period.startsWith("fy") ? fyLabel(Number(period.slice(2))) : monthLabel(period);
  const margin = t.income > 0 ? Math.round((t.profit / t.income) * 100) : null;

  return (
    <RecordListPage>
      <PageHeader
        title="Profit & Loss"
        subtitle="Money in from projects, AMC and other income, less expenses — month by month"
        action={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[200px]" aria-label="Period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All time</SelectItem>
              {years.map((y) => <SelectItem key={y} value={`fy${y}`}>{fyLabel(y)}</SelectItem>)}
              {allMonths.map((m) => <SelectItem key={m.month} value={m.month}>{monthLabel(m.month)}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Project income" value={fmt(t.project)} subtitle={periodLabel} icon={IndianRupee} accent="sky" subtitleColor="muted" />
        <StatCard title="AMC & other income" value={fmt(t.amc + t.other)} subtitle={`AMC ${fmt(t.amc)} · Other ${fmt(t.other)}`} icon={RefreshCcw} accent="violet" subtitleColor="muted" />
        <StatCard title="Expenses" value={fmt(t.spent)} subtitle={periodLabel} icon={TrendingDown} accent="rose" subtitleColor="muted" />
        <StatCard title={t.profit >= 0 ? "Profit" : "Loss"} value={fmt(t.profit)}
          subtitle={margin === null ? "No income yet" : `${margin}% of income`} icon={Scale} accent={t.profit >= 0 ? "emerald" : "rose"} subtitleColor="muted" />
      </div>

      <Panel title="Month by month" subtitle="Click a month to see only that month" flush>
        <ScrollableX>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <Th>Month</Th><Th right>Projects</Th><Th right>AMC</Th><Th right>Other</Th><Th right>Income</Th><Th right>Expenses</Th><Th right>Profit / loss</Th><Th right>Running total</Th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b">{Array.from({ length: 8 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
              ))}
              {!loading && months.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No money in or out in this period</td></tr>}
              {!loading && months.map((m) => (
                <tr key={m.month} className={cn("border-b transition-colors hover:bg-muted/30", ROW_OPEN_CLASS, period === m.month && "bg-primary/5")}
                  {...rowOpenProps(() => setPeriod(period === m.month ? ALL : m.month))}>
                  <Td className="font-medium text-card-foreground">{monthLabel(m.month)}</Td>
                  <Td right>{m.project ? fmt(m.project) : "—"}</Td>
                  <Td right>{m.amc ? fmt(m.amc) : "—"}</Td>
                  <Td right>{m.other ? fmt(m.other) : "—"}</Td>
                  <Td right className="font-medium text-card-foreground">{fmt(m.income)}</Td>
                  <Td right className="text-red-600">{m.spent ? fmt(m.spent) : "—"}</Td>
                  <Td right className={cn("font-semibold", profitClass(m.profit))}>{fmt(m.profit)}</Td>
                  <Td right className={profitClass(running.get(m.month) ?? 0)}>{fmt(running.get(m.month) ?? 0)}</Td>
                </tr>
              ))}
            </tbody>
            {!loading && months.length > 1 && (
              <tfoot>
                <tr className="font-semibold">
                  <Td>{periodLabel}</Td>
                  <Td right>{fmt(t.project)}</Td>
                  <Td right>{fmt(t.amc)}</Td>
                  <Td right>{fmt(t.other)}</Td>
                  <Td right>{fmt(t.income)}</Td>
                  <Td right className="text-red-600">{fmt(t.spent)}</Td>
                  <Td right className={profitClass(t.profit)}>{fmt(t.profit)}</Td>
                  <Td right>{""}</Td>
                </tr>
              </tfoot>
            )}
          </table>
        </ScrollableX>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Where the money came from" subtitle={`${periodLabel} · ${fmt(t.income)}`}>
          <Bars rows={byProject} total={t.income} tone="bg-sky-400" empty="No income" onOpen={() => navigate("/finance")} />
        </Panel>
        <Panel title="Where the money went" subtitle={`${periodLabel} · ${fmt(t.spent)}`}>
          <Bars rows={byCategory.map(([c, v]) => [categoryLabel(c), v, c] as const)} total={t.spent} tone="bg-rose-400" empty="Nothing spent"
            onOpen={(c) => navigate(`/finance/expenses?category=${encodeURIComponent(c)}${/^\d{4}-\d{2}$/.test(period) ? `&month=${period}` : ""}`)} />
        </Panel>
      </div>
    </RecordListPage>
  );
}

/** A labelled bar for each row, as a share of the total; a row opens its list. */
function Bars({ rows, total, tone, empty, onOpen }: {
  rows: readonly (readonly [string, number] | readonly [string, number, string])[];
  total: number; tone: string; empty: string; onOpen: (key: string) => void;
}) {
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <button key={r[0]} type="button" onClick={() => onOpen(r[2] ?? r[0])} className="block w-full text-left">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-card-foreground">{r[0]}</span>
            <span className="tabular-nums font-medium text-card-foreground">
              {fmt(r[1])}<span className="ml-2 text-xs font-normal text-muted-foreground">{total > 0 ? Math.round((r[1] / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div className={cn("h-1.5 rounded-full", tone)} style={{ width: `${total > 0 ? Math.max(2, (r[1] / total) * 100) : 0}%` }} />
          </div>
        </button>
      ))}
    </div>
  );
}
