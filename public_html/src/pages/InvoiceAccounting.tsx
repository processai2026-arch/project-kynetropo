import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BookOpen, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { invoiceAccountingApi, type InvoiceAccountingPL, type JournalEntry } from "@/lib/api/invoiceAccounting";

const TABS = ["P&L Statement", "Journal Entries", "Balance Sheet"] as const;
type Tab = typeof TABS[number];

export default function InvoiceAccounting() {
  const [tab, setTab] = useState<Tab>("P&L Statement");
  const [sortKey, setSortKey] = useState<string>("entry_date");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const resetSort = () => { setSortKey("entry_date"); setSortDir("desc"); };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 ml-1 inline" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" /> : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };
  const [pl, setPl] = useState<InvoiceAccountingPL | null>(null);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loadingPl, setLoadingPl] = useState(false);
  const [loadingJ, setLoadingJ] = useState(false);
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0,8) + "01");
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0,10));

  const loadPl = async () => {
    setLoadingPl(true);
    try {
      const r = await invoiceAccountingApi.profitLoss(fromDate, toDate);
      setPl(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load P&L");
    } finally { setLoadingPl(false); }
  };

  const loadJournals = async () => {
    setLoadingJ(true);
    try {
      const r = await invoiceAccountingApi.journalEntries({ from_date: fromDate, to_date: toDate });
      setJournals(r.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load journal entries");
    } finally { setLoadingJ(false); }
  };

  useEffect(() => { if (tab === "P&L Statement") loadPl(); }, [tab, fromDate, toDate]);
  useEffect(() => { if (tab === "Journal Entries") loadJournals(); }, [tab, fromDate, toDate]);

  const plRow = (label: string, value: number | undefined, bold = false, indent = false) => (
    <div className={`flex justify-between py-2 border-b last:border-0 ${bold ? "font-semibold text-foreground" : "text-card-foreground"}`}>
      <span className={indent ? "pl-4 text-muted-foreground" : ""}>{label}</span>
      <span>₹{(value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Invoice Accounting</h1>
        <div className="flex gap-2 items-center">
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40 text-sm" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40 text-sm" />
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "P&L Statement" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <StatCard title="Revenue" value={pl ? `₹${pl.revenue.toLocaleString("en-IN")}` : "—"} icon={BookOpen} subtitleColor="primary" />
              <StatCard title="Net Profit" value={pl ? `₹${pl.net_profit.toLocaleString("en-IN")}` : "—"} icon={BookOpen} subtitleColor={pl && pl.net_profit > 0 ? "primary" : "muted"} />
            </div>
            <div className="bg-card rounded-xl border shadow-sm p-4">
              <h2 className="text-base font-semibold text-card-foreground mb-3">Profit &amp; Loss</h2>
              {loadingPl ? <Skeleton className="h-48" /> : (
                <div className="text-sm">
                  {plRow("Revenue", pl?.revenue, true)}
                  {plRow("Cost of Goods Sold (35%)", pl?.cogs, false, true)}
                  {plRow("Gross Profit", pl?.gross_profit, true)}
                  {plRow("Shipping Costs", pl?.shipping_cost, false, true)}
                  {plRow("Marketplace Commission", pl?.commission_cost, false, true)}
                  {plRow("Other Expenses", pl?.other_expenses, false, true)}
                  {plRow("Operating Profit", pl?.operating_profit, true)}
                  {plRow("GST Payable", pl?.gst_payable, false, true)}
                  {plRow("Net Profit", pl?.net_profit, true)}
                </div>
              )}
            </div>
          </div>
          <div className="bg-card rounded-xl border shadow-sm p-4">
            <h2 className="text-base font-semibold text-card-foreground mb-3">Expense Breakdown</h2>
            {loadingPl ? <Skeleton className="h-32" /> : (
              <div className="space-y-2 text-sm">
                {[["Shipping", pl?.shipping_cost], ["Commission", pl?.commission_cost], ["Other", pl?.other_expenses]].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between text-card-foreground border-b py-2">
                    <span>{label as string}</span>
                    <span>₹{((val as number) ?? 0).toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Journal Entries" && (
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-card-foreground">Journal Entries</h2>
            {(sortKey !== "entry_date" || sortDir !== "desc") && (
              <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
              </Button>
            )}
          </div>
          <div className="p-4 overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th onClick={() => handleSort("entry_date")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Date<SortIcon col="entry_date" /></th>
                <th onClick={() => handleSort("entry_number")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Entry #<SortIcon col="entry_number" /></th>
                <th onClick={() => handleSort("description")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Description<SortIcon col="description" /></th>
                <th onClick={() => handleSort("debit_account")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Debit Account<SortIcon col="debit_account" /></th>
                <th onClick={() => handleSort("credit_account")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Credit Account<SortIcon col="credit_account" /></th>
                <th onClick={() => handleSort("amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Amount<SortIcon col="amount" /></th>
              </tr></thead>
              <tbody>
                {loadingJ && Array.from({ length: 5 }).map((_, i) => <tr key={i} className="border-b">{Array.from({ length: 6 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>)}</tr>)}
                {!loadingJ && journals.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground text-sm">No journal entries found</td></tr>}
                {!loadingJ && [...journals].sort((a, b) => {
                  const av = (a as any)[sortKey] ?? "";
                  const bv = (b as any)[sortKey] ?? "";
                  const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue","salary","balance_amount"];
                  const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
                  return sortDir === "asc" ? cmp : -cmp;
                }).map(j => (
                  <tr key={j.entry_id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground">{j.entry_date}</td>
                    <td className="py-3 px-4 font-mono text-xs text-card-foreground">{j.entry_number}</td>
                    <td className="py-3 px-4 text-card-foreground">{j.description}</td>
                    <td className="py-3 px-4 text-card-foreground">{j.debit_account}</td>
                    <td className="py-3 px-4 text-card-foreground">{j.credit_account}</td>
                    <td className="py-3 px-4 font-medium text-card-foreground">₹{j.amount.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Balance Sheet" && (
        <div className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="text-base font-semibold text-card-foreground mb-2">Balance Sheet</h2>
          <p className="text-sm text-muted-foreground">Balance sheet tracking is not yet implemented. Full asset/liability tracking requires purchase invoice flows and opening balance entry — deferred to Phase 2.</p>
        </div>
      )}
    </div>
  );
}
