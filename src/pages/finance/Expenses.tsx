import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileUp, Plus, Receipt, Tag, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { RecordListPage } from "@/components/RecordListPage";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { Avatar, Chips, Empty, Fab, List, Loading, Row, SearchBox, TopBar, usePhoneApp } from "@/components/phone/PhoneKit";
import { usePagedRows } from "@/hooks/usePagedRows";
import { opsFinanceApi } from "@/lib/api/ops";
import { formatDate } from "@/lib/format";
import { rowOpenProps, ROW_OPEN_CLASS } from "@/lib/rowNav";
import { cn } from "@/lib/utils";
import type { OpsExpense } from "@/types/ops";
import { categoryLabel, monthLabel, timeLabel } from "./components/ExpenseBits";
import { ImportExpensesDialog } from "./components/ImportExpenses";

const ALL = "all";
const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap", right ? "text-right" : "text-left")}>{children}</th>
);

/** Every expense once, then sliced by month, category and search on the page. */
function useExpenses() {
  const [items, setItems] = useState<OpsExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await opsFinanceApi.expenses()).data ?? []); }
    catch { toast.error("Could not load expenses"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { items, loading, load };
}

/** Month by month: how many and how much, newest first. */
function byMonth(items: OpsExpense[]) {
  const m = new Map<string, { n: number; total: number; cats: Map<string, number> }>();
  for (const e of items) {
    const k = e.date.slice(0, 7);
    const v = m.get(k) ?? { n: 0, total: 0, cats: new Map() };
    v.n++; v.total += Number(e.amount);
    v.cats.set(e.category, (v.cats.get(e.category) ?? 0) + Number(e.amount));
    m.set(k, v);
  }
  return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => ({
    month, n: v.n, total: v.total, top: [...v.cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
  }));
}

/** Every expense: month by month, by category, with a search; each opens its own page. */
export default function Expenses() {
  const phone = usePhoneApp();
  const navigate = useNavigate();
  // Month and category live in the address, so Back from an expense lands on the same list.
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? ALL;
  const category = params.get("category") ?? ALL;
  const setParam = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); n.set(k, v); return n; }, { replace: true });
  const { items, loading, load } = useExpenses();
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);

  const months = useMemo(() => byMonth(items), [items]);
  const categories = useMemo(() => [...new Set(items.map((e) => e.category))].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b))), [items]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((e) =>
      (month === ALL || e.date.startsWith(month)) &&
      (category === ALL || e.category === category) &&
      (!q || [e.description, e.notes, e.category, e.project_name, e.pitch_name, e.added_by].some((v) => (v ?? "").toLowerCase().includes(q))));
  }, [items, month, category, search]);
  const paged = usePagedRows(shown, "expenses");
  const total = shown.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of shown) m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [shown]);
  const period = month === ALL ? "All time" : monthLabel(month);
  const base = phone ? "/sales/expenses" : "/finance/expenses";

  if (phone) {
    // Newest month first, each month its own list with its total.
    const groups = byMonth(shown).map((g) => ({ ...g, rows: shown.filter((e) => e.date.startsWith(g.month)) }));
    return (
      <SalesLayout>
        <TopBar title="Expenses" sub={`${period} · ${fmt(total)}`} back="/sales/more" />
        <Chips value={month} onChange={(v) => setParam("month", v)}
          options={[{ value: ALL, label: "All" }, ...months.map((m) => ({ value: m.month, label: monthLabel(m.month, true) }))]} />
        <SearchBox value={search} onChange={setSearch} placeholder="Search expenses" />
        {loading ? <Loading /> : shown.length === 0 ? (
          <Empty icon={Receipt} text="No expenses here" />
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <List key={g.month} title={`${monthLabel(g.month)} · ${g.n}`} right={<span className="text-xs font-semibold text-red-600">{fmt(g.total)}</span>}>
                {g.rows.map((e) => (
                  <Row key={e.id} to={`${base}/${e.id}`} avatar={<Avatar icon={Receipt} tone="danger" />}
                    title={e.description || categoryLabel(e.category)}
                    meta={<span className="font-semibold text-red-600">{fmt(Number(e.amount))}</span>}
                    sub={[categoryLabel(e.category), formatDate(e.date), timeLabel(e.time)].filter(Boolean).join(" · ")} />
                ))}
              </List>
            ))}
          </div>
        )}
        <Fab to={`${base}/new`} icon={Plus} label="Add" />
      </SalesLayout>
    );
  }

  return (
    <RecordListPage>
      <PageHeader
        title="Expenses"
        subtitle="Money spent, month by month — it comes off the month's profit"
        action={<div className="flex gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}><FileUp className="h-4 w-4 mr-2" />Import</Button>
          <Button onClick={() => navigate(`${base}/new`)}><Plus className="h-4 w-4 mr-2" />Add Expense</Button>
        </div>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Spent" value={fmt(total)} subtitle={period} icon={TrendingDown} accent="rose" subtitleColor="muted" />
        <StatCard title="Expenses" value={String(shown.length)} subtitle={category === ALL ? "All categories" : categoryLabel(category)} icon={Receipt} accent="sky" subtitleColor="muted" />
        <StatCard title="Biggest category" value={byCategory[0] ? categoryLabel(byCategory[0][0]) : "—"}
          subtitle={byCategory[0] ? fmt(byCategory[0][1]) : "Nothing spent"} icon={Tag} accent="amber" subtitleColor="muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Month by month" subtitle="Click a month to see its expenses" flush>
          <ScrollableX>
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><Th>Month</Th><Th right>Expenses</Th><Th right>Spent</Th><Th>Biggest</Th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="p-4"><Skeleton className="h-4 w-full" /></td></tr>}
                {!loading && months.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No expenses yet</td></tr>}
                {months.map((m) => (
                  <tr key={m.month} className={cn("border-b transition-colors hover:bg-muted/30", ROW_OPEN_CLASS, month === m.month && "bg-primary/5")}
                    {...rowOpenProps(() => setParam("month", month === m.month ? ALL : m.month))}>
                    <td className="py-2.5 px-4 font-medium text-card-foreground">{monthLabel(m.month)}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{m.n}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-medium text-red-600">{fmt(m.total)}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{categoryLabel(m.top)}</td>
                  </tr>
                ))}
              </tbody>
              {months.length > 1 && (
                <tfoot><tr className="font-semibold">
                  <td className="py-2.5 px-4">All time</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{items.length}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-red-600">{fmt(items.reduce((s, e) => s + Number(e.amount), 0))}</td>
                  <td />
                </tr></tfoot>
              )}
            </table>
          </ScrollableX>
        </Panel>

        <Panel title="By category" subtitle={period}>
          {byCategory.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Nothing spent</p> : (
            <div className="space-y-2">
              {byCategory.map(([c, amt]) => (
                <button key={c} type="button" onClick={() => setParam("category", category === c ? ALL : c)} className="block w-full text-left">
                  <div className="flex items-center justify-between text-sm">
                    <span className={cn("text-card-foreground", category === c && "font-semibold text-primary")}>{categoryLabel(c)}</span>
                    <span className="tabular-nums font-medium text-card-foreground">{fmt(amt)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-rose-400" style={{ width: `${total > 0 ? Math.max(2, (amt / total) * 100) : 0}%` }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title={`${period} — ${shown.length} expense${shown.length === 1 ? "" : "s"} · ${fmt(total)}`} subtitle="Open an expense to see its notes, change it or delete it" flush>
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <Select value={month} onValueChange={(v) => setParam("month", v)}>
            <SelectTrigger className="w-[200px]" aria-label="Month"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All time</SelectItem>
              {months.map((m) => <SelectItem key={m.month} value={m.month}>{monthLabel(m.month)} · {fmt(m.total)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => setParam("category", v)}>
            <SelectTrigger className="w-[200px]" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Search what for, notes, project…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-[280px]" />
          {(month !== ALL || category !== ALL || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setParams({}, { replace: true }); }}>Clear</Button>
          )}
        </div>
        <ScrollableX>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <Th>Date</Th><Th>Time</Th><Th>Category</Th><Th>What for / notes</Th><Th right>Amount</Th><Th>Project / event</Th><Th>Added by</Th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">{Array.from({ length: 7 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
              ))}
              {!loading && shown.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">No expenses here. <button type="button" className="text-primary hover:underline" onClick={() => navigate(`${base}/new`)}>Add one</button></td></tr>
              )}
              {!loading && paged.rows.map((e, i) => {
                // With all months shown, each month starts with its own heading and total.
                const m = e.date.slice(0, 7);
                const head = month === ALL && (i === 0 || paged.rows[i - 1].date.slice(0, 7) !== m);
                const mt = months.find((x) => x.month === m);
                return (
                  <Fragment key={e.id}>
                    {head && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={4} className="py-2 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{monthLabel(m)} · {mt?.n ?? 0}</td>
                        <td className="py-2 px-4 text-right text-xs font-semibold tabular-nums text-red-600">{fmt(mt?.total ?? 0)}</td>
                        <td colSpan={2} />
                      </tr>
                    )}
                    <tr className={cn("border-b hover:bg-muted/30 transition-colors", ROW_OPEN_CLASS)} {...rowOpenProps(() => navigate(`${base}/${e.id}`))}>
                      <td className="py-3 px-4 whitespace-nowrap text-card-foreground">{formatDate(e.date)}</td>
                      <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">{timeLabel(e.time) || "—"}</td>
                      <td className="py-3 px-4 text-card-foreground">{categoryLabel(e.category)}</td>
                      <td className="py-3 px-4 text-card-foreground">
                        {e.description || "—"}
                        {e.notes && <div className="max-w-xs truncate text-xs text-muted-foreground">{e.notes}</div>}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-red-600">{fmt(Number(e.amount))}</td>
                      <td className="py-3 px-4 text-card-foreground">{e.project_name ?? e.pitch_name ?? "—"}</td>
                      <td className="py-3 px-4 text-card-foreground">{e.added_by || "—"}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </ScrollableX>
        {paged.bar}
      </Panel>

      <ImportExpensesDialog open={importing} onOpenChange={setImporting} onDone={() => void load()} />
    </RecordListPage>
  );
}
