import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, CalendarDays, Flame, Phone, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { salesDashboardApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { TemperatureBadge, formatDate, formatTime, humanise } from "@/components/sales/SalesBits";
import type { SalesDashboard as Dashboard, SalesFollowup, SalesMeeting } from "@/types/sales";
import { cn } from "@/lib/utils";

/**
 * Sales Home — "what do I need to do today?".
 *
 * Mobile-first: a hero greeting, one compact metrics block, then the actual
 * work (today's follow-ups, overdue, meetings, hot leads, challenges).
 */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function MetricRow({ items }: { items: { label: string; value: number; tone?: "danger" | "default" }[] }) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm divide-y">
      {items.map((m) => (
        <div key={m.label} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">{m.label}</span>
          <span
            className={cn(
              "text-xl font-bold tabular-nums",
              m.tone === "danger" && m.value > 0 ? "text-destructive" : "text-card-foreground",
            )}
          >
            {String(m.value).padStart(2, "0")}
          </span>
        </div>
      ))}
    </div>
  );
}

function FollowupCard({ item, overdue }: { item: SalesFollowup; overdue?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/sales/leads/${item.lead_id}`} className="min-w-0 hover:underline">
          <p className="truncate font-semibold text-card-foreground">
            {item.lead_company || item.lead_name}
          </p>
          {item.lead_company && item.lead_name && (
            <p className="truncate text-xs text-muted-foreground">{item.lead_name}</p>
          )}
        </Link>
        {item.lead_temperature && <TemperatureBadge value={item.lead_temperature} />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}>
          <CalendarClock className="h-3.5 w-3.5" />
          {formatDate(item.due_date)}
          {item.due_time ? ` · ${formatTime(item.due_time)}` : ""}
        </span>
        {item.lead_last_outcome && <span>Last: {humanise(item.lead_last_outcome)}</span>}
        {item.assigned_to_name && <span>{item.assigned_to_name}</span>}
      </div>

      {item.purpose && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.purpose}</p>}

      <div className="mt-3">
        <Button size="sm" variant="secondary" className="h-9 w-full sm:w-auto" asChild>
          <Link to={`/sales/leads/${item.lead_id}?action=call`}>
            <Phone className="mr-1.5 h-3.5 w-3.5" />
            Log Call
          </Link>
        </Button>
      </div>
    </div>
  );
}

function MeetingRow({ item }: { item: SalesMeeting }) {
  return (
    <Link
      to={`/sales/leads/${item.lead_id}`}
      className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/40"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-card-foreground">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.lead_company || item.lead_name} · {humanise(item.meeting_type)}
        </p>
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground">
        <div>{formatDate(item.meeting_date)}</div>
        {item.meeting_time && <div className="font-medium text-foreground">{formatTime(item.meeting_time)}</div>}
      </div>
    </Link>
  );
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: { label: string; to: string };
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          {title}
          {count !== undefined && count > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span>
          )}
        </h2>
        {action && (
          <Link to={action.to} className="text-xs font-medium text-primary hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function SalesDashboard() {
  const navigate = useNavigate();
  const { me, can, loading: accessLoading, hasNoAccess } = useSalesAccess();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accessLoading || hasNoAccess) return;
    let cancelled = false;
    setLoading(true);
    salesDashboardApi
      .get()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Could not load the sales dashboard";
        setError(message);
        toast.error(message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accessLoading, hasNoAccess]);

  if (hasNoAccess) {
    return (
      <SalesLayout>
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Sales module</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have access to the sales module. Ask an administrator to grant your sales permissions.
          </p>
        </div>
      </SalesLayout>
    );
  }

  if (loading || accessLoading) {
    return (
      <SalesLayout>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </SalesLayout>
    );
  }

  if (error || !data) {
    return (
      <SalesLayout>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
          <p className="mt-2 text-sm text-destructive">{error ?? "Could not load the sales dashboard"}</p>
          <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </SalesLayout>
    );
  }

  const s = data.summary;
  const firstName = (me?.name ?? "").split(" ")[0];

  return (
    <SalesLayout>
      {/* Hero */}
      <header>
        <p className="text-sm text-muted-foreground">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
        <h1 className="text-2xl font-bold text-foreground">Today's Sales</h1>
      </header>

      <MetricRow
        items={[
          { label: "Follow-Ups Today", value: s.followups_today },
          { label: "Overdue", value: s.followups_overdue, tone: "danger" },
          { label: "Meetings Today", value: s.meetings_today },
        ]}
      />

      {/* Lead temperature summary */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: "Hot", value: s.hot, cls: "text-red-600" },
          { label: "Warm", value: s.warm, cls: "text-amber-600" },
          { label: "Cold", value: s.cold, cls: "text-slate-500" },
        ] as const).map((t) => (
          <Link
            key={t.label}
            to={`/sales/leads?temperature=${t.label.toLowerCase()}`}
            className="rounded-2xl border bg-card p-4 text-center shadow-sm transition-colors hover:bg-muted/40"
          >
            <p className={cn("text-2xl font-bold tabular-nums", t.cls)}>{t.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.label} Leads</p>
          </Link>
        ))}
      </div>

      {/* Overdue first — it is the thing most likely to be missed. */}
      {data.followups.overdue.length > 0 && (
        <Section title="Overdue Follow-Ups" count={s.followups_overdue} action={{ label: "View all", to: "/sales/followups?bucket=overdue" }}>
          <div className="space-y-3">
            {data.followups.overdue.slice(0, 5).map((f) => (
              <FollowupCard key={f.id} item={f} overdue />
            ))}
          </div>
        </Section>
      )}

      <Section title="Today's Follow-Ups" count={s.followups_today} action={{ label: "View all", to: "/sales/followups" }}>
        {data.followups.today.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Nothing due today. {s.followups_upcoming > 0 ? `${s.followups_upcoming} upcoming.` : ""}
          </div>
        ) : (
          <div className="space-y-3">
            {data.followups.today.map((f) => (
              <FollowupCard key={f.id} item={f} />
            ))}
          </div>
        )}
      </Section>

      {can("sales.meetings.view") && (data.meetings.today.length > 0 || data.meetings.upcoming.length > 0) && (
        <Section title="Meetings" action={{ label: "View all", to: "/sales/meetings" }}>
          <div className="space-y-2">
            {data.meetings.today.map((m) => (
              <MeetingRow key={`t-${m.id}`} item={m} />
            ))}
            {data.meetings.upcoming.slice(0, 4).map((m) => (
              <MeetingRow key={`u-${m.id}`} item={m} />
            ))}
          </div>
        </Section>
      )}

      {data.hot_leads.length > 0 && (
        <Section title="Hot Leads" action={{ label: "View all", to: "/sales/leads?temperature=hot" }}>
          <div className="space-y-2">
            {data.hot_leads.slice(0, 5).map((l) => (
              <Link
                key={l.id}
                to={`/sales/leads/${l.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-card-foreground">{l.company || l.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.contact_person || l.name}
                    {l.phone ? ` · ${l.phone}` : ""}
                  </p>
                </div>
                <Flame className="h-4 w-4 shrink-0 text-red-500" />
              </Link>
            ))}
          </div>
        </Section>
      )}

      {can("sales.challenges.view") && (
        <Section title="Sales Challenges" action={{ label: "View all", to: "/sales/challenges" }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-2xl font-bold tabular-nums text-card-foreground">
                {data.challenges.counts.available}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Available</p>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-2xl font-bold tabular-nums text-card-foreground">{s.active_challenges}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Active</p>
            </div>
          </div>
          {data.challenges.active.length > 0 && (
            <div className="mt-3 space-y-2">
              {data.challenges.active.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/sales/challenges/${c.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-card-foreground">{c.title}</span>
                  <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        Server time {new Date(data.server_time.replace(" ", "T")).toLocaleString("en-IN")}
      </div>
    </SalesLayout>
  );
}
