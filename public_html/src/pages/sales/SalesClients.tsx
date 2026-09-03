import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, CalendarClock, ChevronRight, Search, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { salesLeadsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useTeamMembers, namesakeHint } from "@/hooks/useTeamMembers";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { TemperatureBadge, formatDate, formatTime } from "@/components/sales/SalesBits";
import type { SalesLead } from "@/types/sales";

/**
 * Clients — the leads that became customers.
 *
 * Not a second kind of record: a client IS the lead it was converted from, so
 * this is that same list filtered to status "converted", and a row opens the
 * lead's own page. Everything that can be done to a lead can therefore be done
 * to a client — log a call, book a meeting, schedule a follow-up, edit it,
 * change its temperature — except converting, which that page already hides
 * once a lead is converted. Undoing the conversion stays available there.
 *
 * The reason this deserves a tab of its own rather than a status filter on
 * Leads: after the sale, the people chasing a client are asking "who have we
 * sold to, and what do we still owe them", which is a different question from
 * "what is in the pipeline", and mixing them into one list means neither can
 * be worked down.
 */
function ClientCard({ lead }: { lead: SalesLead }) {
  return (
    <Link
      to={`/sales/leads/${lead.id}`}
      className="block rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-card-foreground">{lead.company || lead.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {lead.contact_person || lead.name}
            {lead.phone ? ` · ${lead.phone}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TemperatureBadge value={lead.temperature} />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          <UserCheck className="h-3 w-3" />
          Client
        </span>
        {lead.converted_at && (
          <span className="text-[11px] text-muted-foreground">
            since {formatDate(lead.converted_at.slice(0, 10))}
          </span>
        )}
        {lead.lead_code && <span className="text-[11px] text-muted-foreground">{lead.lead_code}</span>}
      </div>

      {/* What is still owed to them — the only reason to open this list. */}
      {(lead.next_followup_at || lead.next_meeting_at) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {lead.next_followup_at && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              Follow-up {formatDate(lead.next_followup_at.slice(0, 10))}
              {lead.next_followup_at.slice(11, 16) !== "00:00"
                ? ` · ${formatTime(lead.next_followup_at.slice(11))}`
                : ""}
            </span>
          )}
          {lead.next_meeting_at && <span>Meeting {formatDate(lead.next_meeting_at.slice(0, 10))}</span>}
        </div>
      )}

      {lead.assigned_to_name && (
        <p className="mt-2 text-[11px] text-muted-foreground">Owner: {lead.assigned_to_name}</p>
      )}
    </Link>
  );
}

export default function SalesClients() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewAs } = useSalesAccess();

  const [items, setItems] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [owner, setOwner] = useState(searchParams.get("owner") ?? "all");

  const people = useTeamMembers(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesLeadsApi.list({
        search: search || undefined,
        status: "converted",
        assigned_to: owner !== "all" ? owner : undefined,
        limit: 200,
      });
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load clients";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, owner]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the filters shareable/bookmarkable, the way the Leads list does.
  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("search", search);
    if (owner !== "all") next.set("owner", owner);
    setSearchParams(next, { replace: true });
  }, [search, owner, setSearchParams]);

  return (
    <SalesLayout>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 pl-9"
          placeholder="Search name, company, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Hidden while viewing a colleague: the list is already theirs. */}
      {!viewAs && (
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="All owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.user_id} value={String(p.user_id)}>
                {p.name}
                {namesakeHint(p) && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{namesakeHint(p)}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
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
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <Building2 className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search || owner !== "all"
              ? "No clients match these filters."
              : "No clients yet — a lead becomes one when it is converted."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {items.length} client{items.length === 1 ? "" : "s"}
          </p>
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
            {items.map((lead) => (
              <ClientCard key={lead.id} lead={lead} />
            ))}
          </div>
        </>
      )}
    </SalesLayout>
  );
}
