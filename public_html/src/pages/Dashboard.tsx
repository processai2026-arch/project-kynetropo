import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { opsDashboardApi } from "@/lib/api/ops";
import type { OpsDashboardStats } from "@/types/ops";
import {
  IndianRupee, FolderKanban, CalendarDays, AlertCircle,
  RefreshCcw, Users, Sparkles, TrendingUp, Clock,
} from "lucide-react";
import { toast } from "sonner";

const healthStyles: Record<string, string> = {
  green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-600 border-amber-200",
  red:    "bg-red-50 text-red-600 border-red-200",
};

export default function Dashboard() {
  const [data, setData]       = useState<OpsDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    opsDashboardApi.stats()
      .then(res => setData((res as any).data))
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Morning Command Center</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border shadow-sm p-5">
            <Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16" />
          </div>
        )) : <>
          <StatCard title="Total Quoted"    value={fmt(data?.money.total_quoted ?? 0)}           icon={IndianRupee}   subtitleColor="muted" />
          <StatCard title="Total Received"  value={fmt(data?.money.total_received ?? 0)}         icon={TrendingUp}    subtitleColor="primary" />
          <StatCard title="Balance Due"     value={fmt(data?.money.total_balance ?? 0)}          icon={Clock}         subtitleColor="muted" />
          <StatCard title="This Month"      value={fmt(data?.money.this_month_collected ?? 0)}   icon={IndianRupee}   subtitleColor="primary" subtitle="collected" />
          <StatCard title="Red Projects"    value={String(data?.project_health.red ?? 0)}        icon={AlertCircle}   subtitleColor="muted" subtitle={`${data?.project_health.yellow ?? 0} yellow`} />
        </>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Actions */}
        <div className="bg-card rounded-xl border shadow-sm lg:col-span-1">
          <div className="p-4 border-b flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-card-foreground">Today's Actions</h2>
          </div>
          <div className="p-4 space-y-3">
            {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />) : <>
              {(data?.today_actions.followups_today ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Follow-ups Due</p>
                  {data!.today_actions.followups_today.map(f => (
                    <Link key={f.client_id} to={`/clients/${f.client_id}`}
                      className="block py-1.5 text-sm text-primary hover:underline truncate">
                      {f.client_name}
                    </Link>
                  ))}
                </div>
              )}
              {(data?.today_actions.meetings_today ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Meetings Today</p>
                  {data!.today_actions.meetings_today.map(m => (
                    <p key={m.id} className="text-sm text-card-foreground py-1 truncate">
                      {m.client_name ?? "—"} — {new Date(m.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  ))}
                </div>
              )}
              {(data?.today_actions.amc_due_this_month ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">AMC Due This Month</p>
                  {data!.today_actions.amc_due_this_month.map(a => (
                    <p key={a.id} className="text-sm text-card-foreground py-1 truncate">
                      {a.client_name} — ₹{Number(a.amount).toLocaleString("en-IN")}
                    </p>
                  ))}
                </div>
              )}
              {(data?.today_actions.followups_today ?? []).length === 0 &&
               (data?.today_actions.meetings_today ?? []).length === 0 &&
               (data?.today_actions.amc_due_this_month ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">All clear today ✓</p>
              )}
            </>}
          </div>
        </div>

        {/* At-risk Projects */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-card-foreground">At-Risk Projects</h2>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Project","Client","Health","Stage"].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b"><td colSpan={4} className="py-2 px-3"><Skeleton className="h-4 w-full" /></td></tr>
                  ))}
                  {!loading && (data?.project_health.at_risk_projects ?? []).length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No at-risk projects</td></tr>
                  )}
                  {!loading && (data?.project_health.at_risk_projects ?? []).map(p => (
                    <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <Link to={`/projects/${p.id}`} className="font-medium text-primary hover:underline">{p.name}</Link>
                      </td>
                      <td className="py-2 px-3 text-card-foreground">{p.client_name}</td>
                      <td className="py-2 px-3">
                        <Badge className={cn("border capitalize text-xs", healthStyles[p.health])}>{p.health}</Badge>
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground truncate max-w-[120px]">{p.stage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Overdue Collections */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-card-foreground">Overdue Collections</h2>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto eco-float-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Client","Balance","Target Date"].map(h => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b"><td colSpan={3} className="py-2 px-3"><Skeleton className="h-4 w-full" /></td></tr>
                  ))}
                  {!loading && (data?.money.overdue_collections ?? []).length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-sm text-muted-foreground">No overdue collections</td></tr>
                  )}
                  {!loading && (data?.money.overdue_collections ?? []).map(p => (
                    <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-medium text-card-foreground truncate max-w-[120px]">{p.client_name}</td>
                      <td className="py-2 px-3 text-red-600 font-medium">₹{Number(p.balance).toLocaleString("en-IN")}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{p.collection_target_date ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Pipeline + AI Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Summary */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-card-foreground">Lead Pipeline</h2>
          </div>
          <div className="p-4 space-y-2">
            {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />) : (
              <>
                <div className="flex gap-4 text-sm mb-3">
                  <span className="text-muted-foreground">Overdue follow-ups: <strong className="text-foreground">{data?.pipeline.overdue_followups ?? 0}</strong></span>
                  <span className="text-muted-foreground">Proposals awaiting: <strong className="text-foreground">{data?.pipeline.proposals_sent ?? 0}</strong></span>
                </div>
                {(data?.pipeline.by_stage ?? []).map(s => (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-40 truncate">{s.stage}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${Math.min(100, (s.cnt / Math.max(...(data?.pipeline.by_stage ?? [{ cnt: 1 }]).map(x => x.cnt), 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-card-foreground w-4 text-right">{s.cnt}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-card-foreground">AI Recommendations</h2>
          </div>
          <div className="p-4 space-y-2">
            {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />) : (
              (data?.ai_recommendations ?? []).length > 0
                ? (data!.ai_recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-2 text-sm text-card-foreground leading-snug py-1">
                      <span className="text-primary mt-0.5 shrink-0">•</span>
                      <span>{rec.replace(/^[•\-–]\s*/, "")}</span>
                    </div>
                  )))
                : <p className="text-sm text-muted-foreground py-4 text-center">No recommendations available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
