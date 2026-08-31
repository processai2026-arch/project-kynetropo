import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api/client";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";

interface PnlData {
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  shipping_cost: number;
  commission_cost: number;
  other_expenses: number;
  operating_profit: number;
  gst_payable: number;
  net_profit: number;
}

function PnlRow({ label, value, bold, indent, positive, negative }: {
  label: string; value: number; bold?: boolean; indent?: boolean; positive?: boolean; negative?: boolean;
}) {
  const color = positive ? "text-emerald-600" : negative ? "text-red-600" : "text-card-foreground";
  const fmt = (n: number) => "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  return (
    <div className={cn("flex items-center justify-between py-2.5 border-b last:border-0", indent ? "pl-6" : "")}>
      <span className={cn("text-sm", bold ? "font-semibold text-foreground" : "text-card-foreground")}>{label}</span>
      <span className={cn("text-sm font-mono", bold ? "font-bold" : "", color)}>{value < 0 ? "-" : ""}{fmt(value)}</span>
    </div>
  );
}

export default function InvoiceProfitLoss() {
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const firstOfYear = today.slice(0, 4) + "-04-01";
  const [from, setFrom] = useState(firstOfYear);
  const [to, setTo] = useState(today);

  const load = async (f = from, t = to) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: PnlData }>(
        `/admin/invoice-accounting/profit-loss?from_date=${f}&to_date=${t}`
      );
      setData(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load P&L");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const isProfit = data && data.net_profit >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Profit & Loss</h1>
      </div>

      {/* Date filter */}
      <div className="bg-card rounded-xl border shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
          </div>
          <Button onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {loading ? "Loading…" : "Apply"}
          </Button>
          <div className="ml-auto flex gap-2">
            {[
              { label: "This Month", from: today.slice(0,7) + "-01", to: today },
              { label: "This Quarter", from: firstOfYear, to: today },
              { label: "This Year", from: today.slice(0,4) + "-01-01", to: today },
            ].map(p => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => { setFrom(p.from); setTo(p.to); load(p.from, p.to); }}>
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards — use StatCard per design system */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Revenue"
          value={loading ? "—" : `₹${(data?.revenue ?? 0).toLocaleString("en-IN")}`}
          subtitle="All income"
          icon={TrendingUp}
          subtitleColor="primary"
        />
        <StatCard
          title="Gross Profit"
          value={loading ? "—" : `₹${(data?.gross_profit ?? 0).toLocaleString("en-IN")}`}
          subtitle="Revenue minus COGS"
          icon={TrendingUp}
          subtitleColor={(data?.gross_profit ?? 0) >= 0 ? "primary" : "muted"}
        />
        <StatCard
          title="Net Profit"
          value={loading ? "—" : `₹${(data?.net_profit ?? 0).toLocaleString("en-IN")}`}
          subtitle={(data?.net_profit ?? 0) >= 0 ? "Profitable" : "Net loss"}
          icon={(data?.net_profit ?? 0) >= 0 ? TrendingUp : TrendingDown}
          subtitleColor={(data?.net_profit ?? 0) >= 0 ? "primary" : "muted"}
        />
      </div>

      {/* P&L Statement */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold text-card-foreground">Profit & Loss Statement</h2>
          {data && <span className="text-xs text-muted-foreground">{data.from} to {data.to}</span>}
        </div>
        <div className="p-6">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : data ? (
            <div className="space-y-0">
              <div className="py-2 border-b bg-muted/30 -mx-6 px-6 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Income</span>
              </div>
              <PnlRow label="Sales Revenue" value={data.revenue} positive />
              <div className="py-2 border-b bg-muted/30 -mx-6 px-6 mt-4 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost of Goods Sold</span>
              </div>
              <PnlRow label="Cost of Goods Sold (estimated)" value={data.cogs} negative indent />
              <PnlRow label="Gross Profit" value={data.gross_profit} bold positive={data.gross_profit >= 0} negative={data.gross_profit < 0} />
              <div className="py-2 border-b bg-muted/30 -mx-6 px-6 mt-4 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operating Expenses</span>
              </div>
              <PnlRow label="Shipping Cost" value={data.shipping_cost} negative indent />
              <PnlRow label="Marketplace Commission" value={data.commission_cost} negative indent />
              <PnlRow label="Other Expenses" value={data.other_expenses} negative indent />
              <PnlRow label="Operating Profit" value={data.operating_profit} bold positive={data.operating_profit >= 0} negative={data.operating_profit < 0} />
              <div className="py-2 border-b bg-muted/30 -mx-6 px-6 mt-4 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax</span>
              </div>
              <PnlRow label="GST Payable" value={data.gst_payable} negative indent />
              <div className="mt-4 pt-2 border-t-2 border-foreground">
                <PnlRow label="NET PROFIT / LOSS" value={data.net_profit} bold positive={data.net_profit >= 0} negative={data.net_profit < 0} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
