import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Boxes, ClipboardCheck, IndianRupee, PackageX, TrendingDown,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inr0, num, qty, formatDateTime } from "@/lib/inventoryFormat";
import { MovementTypeBadge } from "@/components/inventory/MovementTypeBadge";
import { HealthScoreBadge } from "@/components/inventory/HealthScoreBadge";
import {
  getIntelligenceSummary, getMovements, getPendingApprovals, getReorderSuggestions,
  getDeadStock, getHealthScores,
} from "@/lib/api/inventory";

const ZONE_COLORS = ["#2563eb", "#7c3aed", "#06b6d4", "#f97316", "#ef4444", "#f59e0b", "#64748b"];

export default function InventoryDashboard() {
  const navigate = useNavigate();

  const summary = useQuery({ queryKey: ["inv", "summary"], queryFn: getIntelligenceSummary });
  const movements = useQuery({ queryKey: ["inv", "movements", { limit: 10 }], queryFn: () => getMovements({ limit: 10 }) });
  const approvals = useQuery({ queryKey: ["inv", "approvals", "pending"], queryFn: getPendingApprovals });
  const suggestions = useQuery({ queryKey: ["inv", "reorder", "suggestions", "PENDING"], queryFn: () => getReorderSuggestions("PENDING") });
  const deadStock = useQuery({ queryKey: ["inv", "dead-stock"], queryFn: () => getDeadStock() });
  const health = useQuery({ queryKey: ["inv", "health-scores"], queryFn: getHealthScores });

  const s = summary.data;
  const pendingApprovals = approvals.data ?? [];
  const recentMovements = (movements.data ?? []).slice(0, 10);

  // Total stock value ≈ sum of dead-stock + on-hand value is not directly summarised;
  // use the intelligence summary's dead_stock value plus health coverage as a proxy
  // for the headline. We surface live counts the backend already aggregates.
  const totalStockValue = useMemo(() => {
    const dead = num(s?.dead_stock.total_value);
    const movementValue = (movements.data ?? []).reduce((a, m) => a + num(m.total_value), 0);
    return dead + movementValue;
  }, [s, movements.data]);

  const zoneData = useMemo(() => {
    // Approximate zone distribution from recent movements grouped by zone.
    const by: Record<string, number> = {};
    for (const m of movements.data ?? []) {
      const key = m.zone_name ?? `Zone ${m.zone_id}`;
      by[key] = (by[key] ?? 0) + num(m.quantity);
    }
    return Object.entries(by).map(([name, value]) => ({ name, value }));
  }, [movements.data]);

  const weeklyData = useMemo(() => {
    // Weekly consumption trend from recent movements (outflow types).
    const outflow = new Set(["STOCK_OUT", "EMPLOYEE_ISSUE", "DEALER_ALLOCATION", "PRODUCTION_USE", "DAMAGE", "EMERGENCY_USE"]);
    const by: Record<string, number> = {};
    for (const m of movements.data ?? []) {
      if (!outflow.has(m.movement_type)) continue;
      const d = new Date(String(m.created_at).replace(" ", "T"));
      const key = Number.isNaN(d.getTime()) ? "—" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      by[key] = (by[key] ?? 0) + num(m.quantity);
    }
    return Object.entries(by).map(([day, qty]) => ({ day, qty })).reverse();
  }, [movements.data]);

  const criticalStock = (suggestions.data ?? []).slice(0, 5);
  const writeOffDead = (deadStock.data ?? []).filter((d) => d.severity === "WRITE_OFF_CANDIDATE" || d.severity === "DEAD").slice(0, 5);
  const topHealth = (health.data ?? []).slice().sort((a, b) => a.health_score - b.health_score).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Dashboard</h1>
          <p className="text-muted-foreground">
            Live stock health, consumption and what needs you across the warehouse.
            {s?.generated_at && <span className="ml-1 text-xs">· as of {formatDateTime(s.generated_at)}</span>}
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate("/inventory/intelligence")}>
          Intelligence <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Top row — 4 stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={IndianRupee} label="Total Stock Value" value={inr0(totalStockValue)} tone="primary" />
        <Stat icon={Boxes} label="Total Products" value={String(num(s?.overview.total_products))} tone="primary" />
        <Stat icon={AlertTriangle} label="Low Stock Alerts" value={String((suggestions.data ?? []).length)}
          tone={(suggestions.data ?? []).length ? "red" : "muted"} onClick={() => navigate("/inventory/intelligence")} />
        <Stat icon={ClipboardCheck} label="Pending Approvals" value={String(pendingApprovals.length)}
          tone={pendingApprovals.length ? "amber" : "muted"} onClick={() => navigate("/inventory/approvals")} />
      </div>

      {/* Second row — 2 charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Zone Distribution" icon={Boxes}>
          {zoneData.length === 0 ? <Empty text="No movement data to chart yet." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={zoneData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {zoneData.map((_, i) => <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />)}
                </Pie>
                <RTooltip formatter={(v: number) => qty(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Weekly Consumption Trend" icon={TrendingDown}>
          {weeklyData.length === 0 ? <Empty text="No consumption recorded yet." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={weeklyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RTooltip formatter={(v: number) => qty(v)} />
                <Line type="monotone" dataKey="qty" stroke="#2ea0da" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Third row — 3 alert panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Critical Stock" icon={AlertTriangle} action={{ label: "Reorder", onClick: () => navigate("/inventory/intelligence") }}>
          {criticalStock.length === 0 ? <Empty text="No reorder suggestions pending." /> : (
            <div className="divide-y">
              {criticalStock.map((c) => (
                <div key={c.suggestion_id} className="flex items-center justify-between gap-2 px-1 py-2 text-sm">
                  <span className="truncate">{c.product_name ?? `#${c.inv_product_id}`}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">stock {qty(c.current_stock)} · need {qty(c.suggested_quantity)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Dead Stock Alert" icon={PackageX}>
          {writeOffDead.length === 0 ? <Empty text="No dead stock detected." /> : (
            <div className="divide-y">
              {writeOffDead.map((d) => (
                <div key={d.product_id} className="flex items-center justify-between gap-2 px-1 py-2 text-sm">
                  <span className="truncate">{d.product_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{d.days_since_movement}d · {inr0(d.estimated_value)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Pending Approvals" icon={ClipboardCheck} action={{ label: "Review", onClick: () => navigate("/inventory/approvals") }}>
          {pendingApprovals.length === 0 ? <Empty text="Nothing waiting for approval." /> : (
            <div className="divide-y">
              {pendingApprovals.slice(0, 5).map((a) => (
                <div key={a.approval_id} className="flex items-center justify-between gap-2 px-1 py-2 text-sm">
                  <span className="truncate">{a.product ?? `Movement #${a.movement_id}`}</span>
                  <Badge className={cn("border-transparent", a.is_overdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
                    {a.is_overdue ? "Overdue" : `${num(a.hours_pending)}h`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Bottom row — Recent movements */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-card-foreground">Recent Movements</h2>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-primary" onClick={() => navigate("/inventory/movements")}>
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Type</th><th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">User</th>
                <th className="px-3 py-2">When</th><th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {movements.isLoading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : recentMovements.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No movements yet.</td></tr>
              ) : recentMovements.map((m) => (
                <tr key={m.movement_id} className="border-t">
                  <td className="px-3 py-2"><MovementTypeBadge type={m.movement_type} /></td>
                  <td className="px-3 py-2">{m.product_name ?? `#${m.inv_product_id}`}</td>
                  <td className="px-3 py-2 text-right font-medium">{qty(m.quantity)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{m.moved_by_name ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDateTime(m.created_at)}</td>
                  <td className="px-3 py-2">
                    <Badge className={cn("border-transparent",
                      m.approval_status === "APPROVED" ? "bg-emerald-100 text-emerald-700"
                        : m.approval_status === "PENDING" ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700")}>
                      {m.approval_status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Health snapshot strip */}
      {topHealth.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <TrendingDown className="h-4 w-4 text-muted-foreground" /> Lowest health scores
          </div>
          <div className="flex flex-wrap gap-2">
            {topHealth.map((h) => (
              <div key={h.product_id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                <span className="truncate max-w-[160px]">{h.product_name}</span>
                <HealthScoreBadge score={h.health_score} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone = "primary", onClick }: {
  icon: typeof Boxes; label: string; value: string; tone?: "primary" | "red" | "amber" | "muted"; onClick?: () => void;
}) {
  const valueTone = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-card-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex items-start justify-between rounded-xl border bg-card p-5 text-left shadow-sm transition-colors enabled:hover:bg-muted/40 disabled:cursor-default"
    >
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold", valueTone)}>{value}</p>
      </div>
      <div className="rounded-xl bg-secondary p-3"><Icon className="h-6 w-6 text-primary" /></div>
    </button>
  );
}

function Panel({ title, icon: Icon, children, action }: {
  title: string; icon: typeof Boxes; children: React.ReactNode; action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-card-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</div>
        {action && <Button size="sm" variant="ghost" className="h-7 gap-1 text-primary" onClick={action.onClick}>{action.label} <ArrowRight className="h-3.5 w-3.5" /></Button>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground"><Boxes className="h-6 w-6 opacity-30" /><p className="text-sm">{text}</p></div>;
}
