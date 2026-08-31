import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { salesDashboardApi } from "@/lib/api/sales";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { formatDateTime } from "@/components/sales/SalesBits";
import type { SalesActivityEntry } from "@/types/sales";

/** Recent sales activity across the pipeline, scoped to what the user may see. */
export default function SalesActivity() {
  const [items, setItems] = useState<SalesActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    salesDashboardApi
      .activity(100)
      .then((rows) => {
        setItems(rows);
        setError(null);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Could not load activity";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <SalesLayout>
      <h1 className="text-2xl font-bold text-foreground">Activity History</h1>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
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
          <History className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No sales activity recorded yet.</p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l pl-5">
          {items.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground/50 ring-4 ring-background" />
              <p className="text-sm font-medium text-card-foreground">{a.title}</p>
              <Link to={`/sales/leads/${a.lead_id}`} className="text-xs text-primary hover:underline">
                {a.lead_company || a.lead_name}
              </Link>
              {a.description && <p className="mt-0.5 text-sm text-muted-foreground">{a.description}</p>}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatDateTime(a.occurred_at)}
                {a.actor_name ? ` · ${a.actor_name}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SalesLayout>
  );
}
