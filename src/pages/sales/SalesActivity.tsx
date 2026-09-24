import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock, CalendarPlus, History, MessageSquare, Pause, Phone,
  Play, RefreshCw, Trophy, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { salesDashboardApi } from "@/lib/api/sales";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { formatDateTime } from "@/components/sales/SalesBits";
import type { SalesFeedEvent } from "@/types/sales";
import { cn } from "@/lib/utils";

/**
 * Team Activity — one live stream of everything happening in the module:
 * leads, calls, follow-ups, meetings, challenges and comments, newest first.
 *
 * The desktop keeps it open, so it polls with `since` (a server timestamp)
 * rather than re-fetching the whole list: each poll returns only what has
 * happened since the last one. Scoping is the server's: a lead-scoped user
 * sees their own leads plus team-wide challenge events.
 */

const POLL_MS = 20_000;
const MAX_ITEMS = 250;

function iconFor(event: SalesFeedEvent) {
  if (event.type === "comment_added") return MessageSquare;
  if (event.source === "challenge") return Trophy;
  if (event.type === "call_logged") return Phone;
  if (event.type.startsWith("followup")) return CalendarClock;
  if (event.type.startsWith("meeting")) return CalendarPlus;
  if (event.type.startsWith("lead_")) return UserPlus;
  return History;
}

function toneFor(event: SalesFeedEvent): string {
  if (event.type === "lead_converted") return "bg-emerald-500";
  if (event.type === "comment_added") return "bg-sky-500";
  if (event.source === "challenge") return "bg-amber-500";
  if (event.type === "call_logged") return "bg-primary";
  return "bg-muted-foreground/50";
}

export default function SalesActivity() {
  const [items, setItems] = useState<SalesFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());
  const sinceRef = useRef<string | null>(null);

  const load = useCallback(async (incremental: boolean) => {
    try {
      const res = await salesDashboardApi.feed(
        incremental && sinceRef.current ? { since: sinceRef.current, limit: 60 } : { limit: 100 },
      );
      sinceRef.current = res.server_time;
      setError(null);

      if (!incremental) {
        setItems(res.items);
        return;
      }
      if (res.items.length === 0) return;

      setFreshKeys(new Set(res.items.map((i) => i.key)));
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.key));
        const merged = [...res.items.filter((i) => !seen.has(i.key)), ...prev];
        return merged.slice(0, MAX_ITEMS);
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load activity";
      setError(message);
      // A failed background poll should not shout; only the first load does.
      if (!incremental) toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      // Polling a hidden tab is wasted work — it catches up on focus.
      if (document.visibilityState === "visible") void load(true);
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load(true);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, load]);

  return (
    <SalesLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Activity</h1>
          <p className="text-sm text-muted-foreground">
            Everything happening across leads, meetings and challenges.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              live ? "border-emerald-500/40 text-emerald-700" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50",
              )}
            />
            {live ? "Live" : "Paused"}
          </span>
          <Button variant="outline" size="sm" onClick={() => setLive((v) => !v)}>
            {live ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            {live ? "Pause" : "Resume"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load(true)}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void load(false)}>
              Try again
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <History className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No sales activity recorded yet.</p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l pl-5">
          {items.map((a) => {
            const Icon = iconFor(a);
            return (
              <li
                key={a.key}
                className={cn(
                  "relative rounded-lg transition-colors",
                  freshKeys.has(a.key) && "bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background",
                    toneFor(a),
                  )}
                />
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize text-card-foreground">{a.title}</p>
                    {a.subject && (
                      <Link to={a.url} className="text-xs text-primary hover:underline">
                        {a.subject}
                      </Link>
                    )}
                    {a.description && (
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{a.description}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDateTime(a.at)}
                      {a.actor_name ? ` · ${a.actor_name}` : ""}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SalesLayout>
  );
}
