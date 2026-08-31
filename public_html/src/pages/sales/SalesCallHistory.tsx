import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { salesCallsApi } from "@/lib/api/sales";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { TemperatureBadge, formatDate, formatTime, humanise } from "@/components/sales/SalesBits";
import type { SalesCall } from "@/types/sales";

/** Call history. Logging a call happens on the lead, where the context is. */
export default function SalesCallHistory() {
  const [items, setItems] = useState<SalesCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    salesCallsApi
      .list({ page: 1 })
      .then((res) => {
        setItems(res.data ?? []);
        setError(null);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Could not load call history";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <SalesLayout>
      <h1 className="text-2xl font-bold text-foreground">Call History</h1>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={load}>
              Try again
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <Phone className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No calls logged yet.</p>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
          {items.map((c) => (
            <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/sales/leads/${c.lead_id}`} className="min-w-0 hover:underline">
                  <p className="truncate font-semibold text-card-foreground">{c.lead_company || c.lead_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(c.call_date)}
                    {c.call_time ? ` · ${formatTime(c.call_time)}` : ""}
                    {c.duration_minutes > 0 ? ` · ${c.duration_minutes} min` : ""}
                  </p>
                </Link>
                {c.lead_temperature && <TemperatureBadge value={c.lead_temperature} />}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{humanise(c.outcome)}</p>
              {c.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{c.notes}</p>}
              {c.called_by_name && (
                <p className="mt-2 text-[11px] text-muted-foreground">Logged by {c.called_by_name}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </SalesLayout>
  );
}
