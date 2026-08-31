import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { ShoppingCart, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { marketplaceSalesApi } from "@/lib/api/marketplaceSales";
import type { MarketplaceSalesOrder, SalesSummary } from "@/types/marketplaceSales";

const statusStyles: Record<string, string> = {
  completed: "bg-status-delivered/10 text-status-delivered border-status-delivered/20",
  pending:   "bg-status-pending/10 text-status-pending border-status-pending/20",
  cancelled: "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
  returned:  "bg-status-returned/10 text-status-returned border-status-returned/20",
};

const PERIODS = ["today","week","month","year","all"] as const;

export default function MarketplaceSales() {
  const [items, setItems] = useState<MarketplaceSalesOrder[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("month");
  const [mpFilter, setMpFilter] = useState("all");
  const [search, setSearch] = useState("");
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
        marketplaceSalesApi.list(),
        marketplaceSalesApi.summary(period),
      ]);
      setItems(res.data ?? []);
      setSummary(sumRes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [period]);

  const filtered = useMemo(() => {
    const base = items.filter(o => {
      const ms = mpFilter === "all" || o.marketplace === mpFilter;
      const q = search.toLowerCase();
      const mq = !q || o.order_number.toLowerCase().includes(q) || (o.customer_name ?? "").toLowerCase().includes(q);
      return ms && mq;
    });
    return [...base].sort((a, b) => {
      const av = (a as any)[sortKey] ?? "";
      const bv = (b as any)[sortKey] ?? "";
      const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue"];
      const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, mpFilter, search, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Sales Orders</h1>
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)} className="capitalize">{p}</Button>
          ))}
          {sortKey !== "created_at" && (
            <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Revenue" value={summary ? `₹${summary.revenue.toLocaleString("en-IN")}` : "—"} icon={ShoppingCart} subtitleColor="primary" />
        <StatCard title="Orders" value={summary ? String(summary.orders) : "—"} icon={ShoppingCart} subtitleColor="muted" />
        <StatCard title="Avg Order Value" value={summary ? `₹${summary.avg_order_value.toLocaleString("en-IN")}` : "—"} icon={ShoppingCart} subtitleColor="muted" />
        <StatCard title="Returns" value={summary ? String(summary.returns) : "—"} icon={ShoppingCart} subtitleColor="muted" />
      </div>

      {summary?.by_marketplace && summary.by_marketplace.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summary.by_marketplace.map(mp => (
            <div key={mp.marketplace} className="bg-card rounded-xl border shadow-sm p-4">
              <p className="text-sm font-semibold text-card-foreground capitalize">{mp.marketplace}</p>
              <p className="text-xl font-bold text-foreground mt-1">₹{mp.revenue.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground mt-1">{mp.orders} orders · ₹{mp.commission.toLocaleString("en-IN")} commission</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-3">
          <Input placeholder="Search order#, customer…" value={search} onChange={e => setSearch(e.target.value)} className="w-60" />
          <Select value={mpFilter} onValueChange={setMpFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {["amazon","flipkart","meesho","other"].map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto eco-float-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th onClick={() => handleSort("order_date")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Date<SortIcon col="order_date" /></th>
                  <th onClick={() => handleSort("order_number")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Order #<SortIcon col="order_number" /></th>
                  <th onClick={() => handleSort("marketplace")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Platform<SortIcon col="marketplace" /></th>
                  <th onClick={() => handleSort("customer_name")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Customer<SortIcon col="customer_name" /></th>
                  <th onClick={() => handleSort("total_amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Revenue<SortIcon col="total_amount" /></th>
                  <th onClick={() => handleSort("tax_amount")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Tax<SortIcon col="tax_amount" /></th>
                  <th onClick={() => handleSort("net_revenue")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Net Revenue<SortIcon col="net_revenue" /></th>
                  <th onClick={() => handleSort("status")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Status<SortIcon col="status" /></th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">{Array.from({ length: 8 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>)}</tr>
                ))}
                {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-sm">No orders found</td></tr>}
                {!loading && filtered.map(o => (
                  <tr key={o.order_id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground">{o.order_date}</td>
                    <td className="py-3 px-4 font-mono text-xs text-card-foreground">{o.order_number}</td>
                    <td className="py-3 px-4 capitalize text-card-foreground">{o.marketplace}</td>
                    <td className="py-3 px-4 text-card-foreground">{o.customer_name ?? "—"}</td>
                    <td className="py-3 px-4 text-card-foreground">₹{o.total_amount.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 text-muted-foreground">₹{o.tax_amount.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 font-medium text-card-foreground">₹{o.net_revenue.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4">
                      <Badge className={cn("border capitalize", statusStyles[o.status] ?? "bg-muted text-muted-foreground")}>{o.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
