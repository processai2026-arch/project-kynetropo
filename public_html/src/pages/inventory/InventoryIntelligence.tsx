import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, PackageX, ShieldAlert, TrendingDown } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { inr0, num, qty, formatDate, formatDateTime, severityChip } from "@/lib/inventoryFormat";
import { HealthScoreBadge } from "@/components/inventory/HealthScoreBadge";
import { MovementTypeBadge } from "@/components/inventory/MovementTypeBadge";
import {
  getIntelligenceSummary, getHealthScores, getDeadStock, getRunoutPredictions, getAbnormalMovements,
  type HealthScore,
} from "@/lib/api/inventory";

const HEALTH_COLORS: Record<string, string> = { healthy: "#10b981", warning: "#f59e0b", at_risk: "#f97316", critical: "#ef4444" };

export default function InventoryIntelligence() {
  const summary = useQuery({ queryKey: ["inv", "summary"], queryFn: getIntelligenceSummary });
  const health = useQuery({ queryKey: ["inv", "health-scores"], queryFn: getHealthScores });
  const deadStock = useQuery({ queryKey: ["inv", "dead-stock"], queryFn: () => getDeadStock() });
  const runout = useQuery({ queryKey: ["inv", "runout"], queryFn: getRunoutPredictions });
  const abnormal = useQuery({ queryKey: ["inv", "abnormal"], queryFn: () => getAbnormalMovements() });

  const [healthSort, setHealthSort] = useState<"asc" | "desc">("asc");
  const [healthDetail, setHealthDetail] = useState<HealthScore | null>(null);

  const o = summary.data?.overview;
  const donut = useMemo(() => o ? [
    { key: "healthy", name: "Healthy", value: o.healthy },
    { key: "warning", name: "Warning", value: o.warning },
    { key: "at_risk", name: "At Risk", value: o.at_risk },
    { key: "critical", name: "Critical", value: o.critical },
  ].filter((d) => d.value > 0) : [], [o]);

  const sortedHealth = useMemo(() => {
    const dir = healthSort === "asc" ? 1 : -1;
    return (health.data ?? []).slice().sort((a, b) => (a.health_score - b.health_score) * dir);
  }, [health.data, healthSort]);

  const deadRows = deadStock.data ?? [];
  const writeOffs = deadRows.filter((d) => d.severity === "WRITE_OFF_CANDIDATE");

  const runoutRows = (runout.data ?? []).filter((r) => r.days_until_stockout !== null)
    .slice().sort((a, b) => (a.days_until_stockout ?? 0) - (b.days_until_stockout ?? 0));
  const criticalRunouts = runoutRows.filter((r) => (r.days_until_stockout ?? 99) < 7);

  const abnormalRows = abnormal.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory Intelligence</h1>
        <p className="text-muted-foreground">
          Health, dead stock, runout forecasts and abnormal-movement flags.
          {summary.data?.generated_at && <span className="ml-1 text-xs">· as of {formatDateTime(summary.data.generated_at)}</span>}
        </p>
      </div>

      {/* Section 1 — Health Overview */}
      <Section title="Health Overview" icon={TrendingDown}>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            {donut.length === 0 ? <Empty text="No health data yet." /> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {donut.map((d) => <Cell key={d.key} fill={HEALTH_COLORS[d.key]} />)}
                  </Pie>
                  <RTooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Product</th><th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2 cursor-pointer" onClick={() => setHealthSort((s) => s === "asc" ? "desc" : "asc")}>Health {healthSort === "asc" ? "↑" : "↓"}</th>
                    <th className="px-3 py-2">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {health.isLoading ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
                  ) : sortedHealth.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No products scored.</td></tr>
                  ) : sortedHealth.slice(0, 30).map((h) => (
                    <tr key={h.product_id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => setHealthDetail(h)}>
                      <td className="px-3 py-2 font-medium text-card-foreground">{h.product_name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{h.sku}</td>
                      <td className="px-3 py-2 font-semibold">{Math.round(h.health_score)}</td>
                      <td className="px-3 py-2"><HealthScoreBadge score={h.health_score} showValue={false} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 2 — Dead Stock */}
      <Section title="Dead Stock" icon={PackageX}>
        {writeOffs.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="h-5 w-5" /> {writeOffs.length} product{writeOffs.length === 1 ? "" : "s"} are write-off candidates — totalling {inr0(writeOffs.reduce((a, d) => a + num(d.estimated_value), 0))}.
          </div>
        )}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Qty stuck</th>
                  <th className="px-3 py-2 text-right">Days inactive</th><th className="px-3 py-2 text-right">Value</th>
                  <th className="px-3 py-2">Severity</th>
                </tr>
              </thead>
              <tbody>
                {deadStock.isLoading ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : deadRows.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No dead stock detected.</td></tr>
                ) : deadRows.map((d) => (
                  <tr key={d.product_id} className="border-t">
                    <td className="px-3 py-2 font-medium text-card-foreground">{d.product_name}</td>
                    <td className="px-3 py-2 text-right">{qty(d.quantity_stuck)}</td>
                    <td className="px-3 py-2 text-right">{d.days_since_movement}</td>
                    <td className="px-3 py-2 text-right">{inr0(d.estimated_value)}</td>
                    <td className="px-3 py-2"><Badge className={cn("border-transparent", severityChip[d.severity] ?? "bg-slate-100 text-slate-600")}>{d.severity.replace(/_/g, " ")}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Section 3 — Runout Predictions */}
      <Section title="Stock Runout Predictions" icon={Clock}>
        {criticalRunouts.length > 0 && (
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {criticalRunouts.slice(0, 6).map((r) => (
              <div key={r.product_id} className="rounded-xl border-l-4 border border-red-400 bg-card p-4 shadow-sm">
                <p className="truncate font-semibold text-card-foreground">{r.product_name}</p>
                <p className="mt-1 text-2xl font-bold text-red-600">{Math.floor(r.days_until_stockout ?? 0)}d</p>
                <p className="text-xs text-muted-foreground">stock {qty(r.current_stock)} · ~{qty(r.avg_daily_consumption)}/day · reorder {qty(r.suggested_reorder_qty)}</p>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-right">Days left</th><th className="px-3 py-2">Predicted date</th>
                  <th className="px-3 py-2">Risk</th>
                </tr>
              </thead>
              <tbody>
                {runout.isLoading ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
                ) : runoutRows.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No runout risk — consumption is stable.</td></tr>
                ) : runoutRows.map((r) => (
                  <tr key={r.product_id} className="border-t">
                    <td className="px-3 py-2 font-medium text-card-foreground">{r.product_name}</td>
                    <td className="px-3 py-2 text-right">{qty(r.current_stock)}</td>
                    <td className="px-3 py-2 text-right font-medium">{r.days_until_stockout !== null ? `${Math.floor(r.days_until_stockout)}d` : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(r.predicted_stockout_date)}</td>
                    <td className="px-3 py-2"><Badge className={cn("border-transparent", severityChip[r.risk_level] ?? "bg-slate-100 text-slate-600")}>{r.risk_level}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Section 4 — Abnormal Movements */}
      <Section title="Abnormal Movements" icon={ShieldAlert}>
        <div className="rounded-xl border bg-card shadow-sm">
          {abnormal.isLoading ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : abnormalRows.length === 0 ? (
            <Empty text="No abnormal movements flagged in the recent window." />
          ) : (
            <div className="divide-y">
              {abnormalRows.map((a) => (
                <div key={a.movement_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <MovementTypeBadge type={a.movement_type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-card-foreground">{a.product_name} <span className="font-mono text-xs text-muted-foreground">{a.sku}</span></p>
                    <p className="text-xs text-muted-foreground">
                      {qty(a.quantity)} · {inr0(a.total_value)} · {a.zone_name} · {formatDateTime(a.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{a.recommended_action}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={cn("border-transparent", severityChip[a.severity] ?? "bg-slate-100 text-slate-600")}>{a.severity}</Badge>
                    <div className="flex flex-wrap justify-end gap-1">
                      {a.flag_reasons.map((r) => <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{r.replace(/_/g, " ")}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Health detail modal */}
      <Dialog open={!!healthDetail} onOpenChange={(v) => !v && setHealthDetail(null)}>
        <DialogContent className="max-w-md">
          {healthDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">{healthDetail.product_name} <HealthScoreBadge score={healthDetail.health_score} /></DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">SKU {healthDetail.sku} · risk level <span className="font-medium text-foreground">{healthDetail.risk_level}</span></p>
              <div className="mt-2 space-y-2">
                {Object.entries(healthDetail.breakdown).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, num(v) * 3)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Clock; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Icon className="h-5 w-5 text-primary" /> {title}</h2>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground"><ShieldAlert className="h-6 w-6 opacity-30" /><p className="text-sm">{text}</p></div>;
}
