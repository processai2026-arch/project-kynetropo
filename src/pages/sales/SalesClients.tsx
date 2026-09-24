import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, CalendarClock, Lock, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { opsClientsApi } from "@/lib/api/ops";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { formatDate } from "@/components/sales/SalesBits";
import type { OpsClient } from "@/types/ops";
import { cn } from "@/lib/utils";

/**
 * Clients — the customer records from the admin dashboard, read-only.
 *
 * This is the same `ops_clients` data the dashboard's Clients page shows, not a
 * sales-side copy of it. Nothing here can be edited: a client's details, its
 * project and every figure on it are owned by the dashboard, and one screen
 * quietly disagreeing with another about what a customer has paid is worse than
 * having to switch screens to change it.
 *
 * What sales can still DO with a client lives on its lead — log a call, book a
 * meeting, schedule a follow-up — so a client that came through sales links
 * there. That is an action on the sales record, not an edit of the customer.
 */
const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

const healthStyles: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-600 border-amber-200",
  red: "bg-red-50 text-red-600 border-red-200",
};

const paymentStyles: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial: "bg-amber-50 text-amber-600 border-amber-200",
  pending: "bg-muted text-muted-foreground border-border",
  overdue: "bg-red-50 text-red-600 border-red-200",
};

/** One figure. Dashes for absent rather than ₹0, which would be a claim. */
function Money({ label, value, tone }: { label: string; value: number | null; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("truncate text-sm font-semibold tabular-nums", tone ?? "text-card-foreground")}>
        {value === null ? "—" : inr(value)}
      </p>
    </div>
  );
}

function ClientCard({ client }: { client: OpsClient }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-card-foreground">{client.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {client.phone || "no phone"}
            {client.email ? ` · ${client.email}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
            healthStyles[client.health] ?? "bg-muted text-muted-foreground border-border",
          )}
        >
          {client.health}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          {client.stage}
        </span>
        {client.payment_status && (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
              paymentStyles[client.payment_status] ?? "",
            )}
          >
            {client.payment_status}
          </span>
        )}
      </div>

      {/* Project */}
      <div className="mt-3 rounded-xl border bg-muted/30 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Project</p>
        <p className="truncate text-sm text-card-foreground">
          {client.project_name ?? <span className="text-muted-foreground">No project yet</span>}
        </p>
      </div>

      {/* The money */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Money label="Amount" value={client.quoted} />
        <Money label="Paid" value={client.received} tone="text-emerald-700" />
        <Money
          label="Balance"
          value={client.balance_due}
          tone={client.balance_due && client.balance_due > 0 ? "text-red-600" : undefined}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {client.owner && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {client.owner}
          </span>
        )}
        {client.next_followup && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            Follow-up {formatDate(client.next_followup.slice(0, 10))}
          </span>
        )}
        {client.days_since_contact !== null && (
          <span>{client.days_since_contact}d since contact</span>
        )}
      </div>

      {client.sales_lead_id && (
        <Link
          to={`/sales/leads/${client.sales_lead_id}`}
          className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
        >
          Open the sales record — call, meeting, follow-up →
        </Link>
      )}
    </div>
  );
}

export default function SalesClients() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<OpsClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [stage, setStage] = useState(searchParams.get("stage") ?? "all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await opsClientsApi.list(search ? { search } : undefined);
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load clients";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("search", search);
    if (stage !== "all") next.set("stage", stage);
    setSearchParams(next, { replace: true });
  }, [search, stage, setSearchParams]);

  // Stages come from the data rather than a fixed list, so a stage renamed in
  // the dashboard does not quietly disappear from this filter.
  const stages = useMemo(
    () => [...new Set(items.map((c) => c.stage).filter(Boolean))].sort(),
    [items],
  );
  const shown = stage === "all" ? items : items.filter((c) => c.stage === stage);

  const totals = useMemo(
    () =>
      shown.reduce(
        (a, c) => ({
          quoted: a.quoted + (c.quoted ?? 0),
          received: a.received + (c.received ?? 0),
          balance: a.balance + (c.balance_due ?? 0),
        }),
        { quoted: 0, received: 0, balance: 0 },
      ),
    [shown],
  );

  return (
    <SalesLayout>
      <h1 className="text-2xl font-bold tracking-tight">Clients</h1>

      <p className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3 shrink-0" />
        Read-only — client details and figures are edited in the admin dashboard.
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 pl-9"
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {stages.length > 1 && (
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <Building2 className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search || stage !== "all" ? "No clients match these filters." : "No clients yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">
              {shown.length} client{shown.length === 1 ? "" : "s"}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Money label="Amount" value={totals.quoted} />
              <Money label="Paid" value={totals.received} tone="text-emerald-700" />
              <Money
                label="Balance"
                value={totals.balance}
                tone={totals.balance > 0 ? "text-red-600" : undefined}
              />
            </div>
          </div>

          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
            {shown.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        </>
      )}
    </SalesLayout>
  );
}
