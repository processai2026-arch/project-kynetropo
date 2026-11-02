import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, Plus, Receipt, Tag, TrendingDown } from "lucide-react";
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
import { usePagedRows } from "@/hooks/usePagedRows";
import { opsFinanceApi } from "@/lib/api/ops";
import { formatDate } from "@/lib/format";
import { rowOpenProps, ROW_OPEN_CLASS } from "@/lib/rowNav";
import { cn } from "@/lib/utils";
import type { OpsExpense } from "@/types/ops";
import { categoryLabel } from "./components/ExpenseBits";

const ALL = "all";
const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap", right ? "text-right" : "text-left")}>{children}</th>
);

/** Every expense: by month (or all time), by category, with a search; each opens its own page. */
export default function Expenses() {
  const navigate = useNavigate();
  // Month and category live in the address, so Back from an expense lands on the same list.
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? new Date().toISOString().slice(0, 7);
  const category = params.get("category") ?? ALL;
  const setParam = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); n.set(k, v); return n; }, { replace: true });

  const [items, setItems] = useState<OpsExpense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q: Record<string, string> = {};
      if (month !== ALL) q.month = month;
      if (category !== ALL) q.category = category;
      const res = await opsFinanceApi.expenses(q);
      setItems(res.data ?? []);
    } catch { toast.error("Could not load expenses"); }
    finally { setLoading(false); }
  }, [month, category]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { opsFinanceApi.expenseCategories().then((r) => setCategories(r.data ?? [])).catch(() => undefined); }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) => [e.description, e.notes, e.category, e.project_name, e.pitch_name, e.added_by]
      .some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [items, search]);
  const paged = usePagedRows(shown, "expenses");

  const total = shown.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of shown) m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [shown]);
  const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
  const period = month === ALL ? "All time" : new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <RecordListPage>
      <PageHeader
        title="Expenses"
        subtitle="Money spent — it comes off the month's profit"
        action={<Button onClick={() => navigate("/finance/expenses/new")}><Plus className="h-4 w-4 mr-2" />Add Expense</Button>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard title="Spent" value={fmt(total)} subtitle={period} icon={TrendingDown} accent="rose" subtitleColor="muted" />
        <StatCard title="Expenses" value={String(shown.length)} subtitle={category === ALL ? "All categories" : categoryLabel(category)} icon={Receipt} accent="sky" subtitleColor="muted" />
        <StatCard title="Biggest category" value={byCategory[0] ? categoryLabel(byCategory[0][0]) : "—"}
          subtitle={byCategory[0] ? fmt(byCategory[0][1]) : "Nothing spent"} icon={Tag} accent="amber" subtitleColor="muted" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input type="month" value={month === ALL ? "" : month} onChange={(e) => setParam("month", e.target.value || ALL)} className="w-[170px]" aria-label="Month" />
          <Button variant={month === ALL ? "default" : "outline"} size="sm" onClick={() => setParam("month", month === ALL ? new Date().toISOString().slice(0, 7) : ALL)}>
            <CalendarDays className="h-4 w-4 mr-1" />{month === ALL ? "All time" : "Show all time"}
          </Button>
        </div>
        <Select value={category} onValueChange={(v) => setParam("category", v)}>
          <SelectTrigger className="w-[190px]" aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Search what for, notes, project…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-[280px]" />
      </div>

      {byCategory.length > 1 && (
        <Panel title="By category" subtitle={period}>
          <div className="space-y-2">
            {byCategory.map(([c, amt]) => (
              <button key={c} type="button" onClick={() => setParam("category", c)} className="block w-full text-left">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-card-foreground">{categoryLabel(c)}</span>
                  <span className="tabular-nums font-medium text-card-foreground">{fmt(amt)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-rose-400" style={{ width: `${total > 0 ? Math.max(2, (amt / total) * 100) : 0}%` }} />
                </div>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <Panel title={`${period} — ${shown.length} expense${shown.length === 1 ? "" : "s"}`} subtitle="Open an expense to see its notes, change it or delete it" flush>
        <ScrollableX>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <Th>Date</Th><Th>Category</Th><Th>What for</Th><Th right>Amount</Th><Th>Project / event</Th><Th>Added by</Th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
              ))}
              {!loading && shown.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">No expenses here. <button type="button" className="text-primary hover:underline" onClick={() => navigate("/finance/expenses/new")}>Add one</button></td></tr>
              )}
              {!loading && paged.rows.map((e) => (
                <tr key={e.id} className={cn("border-b hover:bg-muted/30 transition-colors", ROW_OPEN_CLASS)} {...rowOpenProps(() => navigate(`/finance/expenses/${e.id}`))}>
                  <td className="py-3 px-4 whitespace-nowrap text-card-foreground">{formatDate(e.date)}</td>
                  <td className="py-3 px-4 text-card-foreground">{categoryLabel(e.category)}</td>
                  <td className="py-3 px-4 text-card-foreground">
                    {e.description || "—"}
                    {e.notes && <div className="max-w-xs truncate text-xs text-muted-foreground">{e.notes}</div>}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums font-medium text-red-600">{fmt(Number(e.amount))}</td>
                  <td className="py-3 px-4 text-card-foreground">{e.project_name ?? e.pitch_name ?? "—"}</td>
                  <td className="py-3 px-4 text-card-foreground">{e.added_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableX>
        {paged.bar}
      </Panel>
    </RecordListPage>
  );
}
