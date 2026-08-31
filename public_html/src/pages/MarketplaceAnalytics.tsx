import { useState, useEffect } from "react";
import { toast } from "sonner";
import { TrendingUp, Plus, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { marketplaceApi } from "@/lib/api/marketplace";
import type { MarketplaceAnalytics, MarketplaceSettlement } from "@/types/marketplace";

const settlementStatusStyles: Record<string, string> = {
  pending:  "bg-status-pending/10 text-status-pending border-status-pending/20",
  received: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disputed: "bg-red-50 text-red-600 border-red-200",
};

const EMPTY: Partial<MarketplaceSettlement> = { marketplace: "amazon", period_start: "", period_end: "", gross_sales: 0, status: "pending" };

const PLATFORMS = ["all", "amazon", "flipkart", "meesho"] as const;
type Platform = typeof PLATFORMS[number];

export default function MarketplaceAnalytics() {
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

  const [analytics, setAnalytics] = useState<MarketplaceAnalytics | null>(null);
  const [settlements, setSettlements] = useState<MarketplaceSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<Platform>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Partial<MarketplaceSettlement>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([marketplaceApi.analytics(), marketplaceApi.settlements()]);
      setAnalytics(a);
      setSettlements(s.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.marketplace || !form.period_start || !form.period_end) { toast.error("Marketplace and period are required"); return; }
    setSaving(true);
    try {
      await marketplaceApi.storeSettlement(form);
      toast.success("Settlement added");
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Marketplace Analytics</h1>
        <Button onClick={() => { setForm(EMPTY); setFormOpen(true); }}><Plus className="h-4 w-4 mr-2" />Add Settlement</Button>
      </div>

      {/* Platform filter tabs */}
      <div className="flex gap-0 border-b">
        {PLATFORMS.map(p => (
          <button key={p} onClick={() => setPlatformFilter(p)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize whitespace-nowrap ${platformFilter === p ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {p === "all" ? "All Platforms" : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />) : (() => {
          const filtered = platformFilter === "all" ? analytics?.platforms : analytics?.platforms.filter(p => p.marketplace === platformFilter);
          const rev  = filtered?.reduce((s, p) => s + p.revenue, 0) ?? 0;
          const comm = filtered?.reduce((s, p) => s + p.commission, 0) ?? 0;
          const ret  = filtered?.reduce((s, p) => s + p.returns, 0) ?? 0;
          return (
            <>
              <StatCard title="Total Revenue"    value={`₹${rev.toLocaleString("en-IN")}`}   icon={TrendingUp} subtitleColor="primary" />
              <StatCard title="Total Commission" value={`₹${comm.toLocaleString("en-IN")}`}  icon={TrendingUp} subtitleColor="muted" />
              <StatCard title="Total Returns"    value={String(ret)}                          icon={TrendingUp} subtitleColor="muted" />
            </>
          );
        })()}
      </div>

      {!loading && analytics && (analytics.platforms.filter(p => platformFilter === "all" || p.marketplace === platformFilter)).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {analytics.platforms.filter(p => platformFilter === "all" || p.marketplace === platformFilter).map(p => (
            <div key={p.marketplace} className="bg-card rounded-xl border shadow-sm p-4">
              <p className="text-sm font-semibold text-card-foreground capitalize mb-2">{p.marketplace}</p>
              <p className="text-xl font-bold text-foreground">₹{p.revenue.toLocaleString("en-IN")}</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>{p.orders} orders</p>
                <p>Commission: ₹{p.commission.toLocaleString("en-IN")} ({p.commission_pct}%)</p>
                <p>Returns: {p.returns}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revenue comparison bar */}
      {!loading && analytics && analytics.platforms.length > 1 && (
        <div className="bg-card rounded-xl border shadow-sm p-5">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Revenue Comparison</h2>
          <div className="space-y-3">
            {analytics.platforms
              .filter(p => platformFilter === "all" || p.marketplace === platformFilter)
              .map(p => {
                const maxRev = Math.max(...analytics.platforms.map(x => x.revenue), 1);
                const pct = Math.round((p.revenue / maxRev) * 100);
                return (
                  <div key={p.marketplace} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-card-foreground capitalize w-20 shrink-0">{p.marketplace}</span>
                    <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                      <div className="h-full bg-primary rounded-md transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-card-foreground w-24 text-right shrink-0">₹{p.revenue.toLocaleString("en-IN")}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-semibold text-card-foreground">Settlements</h2>
          {(sortKey !== "created_at" || sortDir !== "desc") && (
            <Button variant="outline" size="sm" onClick={resetSort} className="text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />Reset Sort
            </Button>
          )}
        </div>
        <div className="p-4 overflow-x-auto eco-float-scroll">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th onClick={() => handleSort("marketplace")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Platform<SortIcon col="marketplace" /></th>
              <th onClick={() => handleSort("period_start")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Period<SortIcon col="period_start" /></th>
              <th onClick={() => handleSort("gross_sales")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Gross Sales<SortIcon col="gross_sales" /></th>
              <th onClick={() => handleSort("marketplace_commission")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Commission<SortIcon col="marketplace_commission" /></th>
              <th onClick={() => handleSort("tds_deducted")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">TDS<SortIcon col="tds_deducted" /></th>
              <th onClick={() => handleSort("payment_received")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Received<SortIcon col="payment_received" /></th>
              <th onClick={() => handleSort("difference")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Difference<SortIcon col="difference" /></th>
              <th onClick={() => handleSort("status")} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none">Status<SortIcon col="status" /></th>
            </tr></thead>
            <tbody>
              {loading && Array.from({ length: 3 }).map((_, i) => <tr key={i} className="border-b">{Array.from({ length: 8 }).map((_, j) => <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>)}</tr>)}
              {!loading && settlements.length === 0 && <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-sm">No settlements recorded</td></tr>}
              {!loading && [...settlements].sort((a, b) => {
                const av = (a as any)[sortKey] ?? "";
                const bv = (b as any)[sortKey] ?? "";
                const numKeys = ["total_amount","tax_amount","amount","lifetime_revenue","current_stock","damaged_stock","net_revenue","salary","balance_amount","gross_sales","marketplace_commission","tds_deducted","payment_received","difference"];
                const cmp = numKeys.includes(sortKey) ? Number(av) - Number(bv) : String(av).localeCompare(String(bv));
                return sortDir === "asc" ? cmp : -cmp;
              }).map(s => (
                <tr key={s.settlement_id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 capitalize font-medium text-card-foreground">{s.marketplace}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{s.period_start} to {s.period_end}</td>
                  <td className="py-3 px-4 text-card-foreground">₹{s.gross_sales.toLocaleString("en-IN")}</td>
                  <td className="py-3 px-4 text-card-foreground">₹{s.marketplace_commission.toLocaleString("en-IN")}</td>
                  <td className="py-3 px-4 text-card-foreground">₹{s.tds_deducted.toLocaleString("en-IN")}</td>
                  <td className="py-3 px-4 text-card-foreground">₹{s.payment_received.toLocaleString("en-IN")}</td>
                  <td className="py-3 px-4 text-card-foreground">₹{s.difference.toLocaleString("en-IN")}</td>
                  <td className="py-3 px-4">
                    <Badge className={cn("border capitalize", settlementStatusStyles[s.status] ?? "bg-muted text-muted-foreground")}>{s.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={v => { if (!saving) setFormOpen(v); }}>
        <DialogContent onInteractOutside={e => e.preventDefault()}>
          <DialogHeader><DialogTitle>Add Settlement</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Marketplace</Label>
                <CreatableCombobox optionsKey="marketplace" value={form.marketplace ?? "amazon"} onChange={v => set("marketplace", v)} placeholder="Select marketplace…" />
              </div>
              <div className="space-y-1.5"><Label>Period Start</Label><Input type="date" value={form.period_start ?? ""} onChange={e => set("period_start", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Period End</Label><Input type="date" value={form.period_end ?? ""} onChange={e => set("period_end", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Gross Sales (₹)</Label><Input type="number" value={form.gross_sales ?? 0} onChange={e => set("gross_sales", Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Payment Received (₹)</Label><Input type="number" value={form.payment_received ?? 0} onChange={e => set("payment_received", Number(e.target.value))} /></div>
              <div className="space-y-1.5 col-span-2">
                <Label>Status</Label>
                <CreatableCombobox optionsKey="settlement_status" value={form.status ?? "pending"} onChange={v => set("status", v)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
