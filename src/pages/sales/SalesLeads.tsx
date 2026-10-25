import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Megaphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { salesLeadsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { humanise, sourceLabel } from "@/components/sales/SalesBits";
import { Avatar, Chips, Empty, HeroAvatar, HeroBar, List, Loading, PhoneSelect, Row, SearchBox, shortDate, usePhoneApp } from "@/components/phone/PhoneKit";
import { TempPill } from "./phone/SalesPhoneHome";
import { LeadsRegister } from "@/components/sales/LeadsRegister";
import type { SalesLead } from "@/types/sales";

const TEMPERATURES = ["hot", "warm", "cold"] as const;

/**
 * The owner filter outlives the visit.
 *
 * Someone who works one colleague's leads sets this once and means it — having
 * to re-pick a name on every visit would make the filter more trouble than
 * scrolling past the rows it hides. localStorage rather than the session, so it
 * survives closing the browser too, and it is always visible on screen as a
 * selected value rather than silently filtering the list.
 */
const OWNER_KEY = "kyn_sales_lead_owner";

function storedOwner(): string {
  try {
    return localStorage.getItem(OWNER_KEY) ?? "all";
  } catch {
    return "all";
  }
}
/** Rows per fetch; the next 25 load as the list nears its end. */
const PAGE_SIZE = 25;

const STATUSES = [
  "new", "contacted", "qualified", "meeting_scheduled",
  "proposal", "onboarding", "converted", "lost",
] as const;

/** Leads: the phone app's chat-style list on a phone, the CRM register on a computer. */
export default function SalesLeads() {
  return usePhoneApp() ? <PhoneLeads /> : <SalesLayout><LeadsRegister /></SalesLayout>;
}

function PhoneLeads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, viewAs, me } = useSalesAccess();

  const [items, setItems] = useState<SalesLead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [temperature, setTemperature] = useState(searchParams.get("temperature") ?? "all");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  // A link with ?owner= wins for that visit; otherwise the last choice stands.
  const [owner, setOwner] = useState(() => searchParams.get("owner") ?? storedOwner());

  const people = useTeamMembers(true);

  // Newest lead number first, 25 at a time. Each fetch takes a ticket; an answer
  // that arrives after the filters changed (or a newer fetch began) is dropped.
  const ticket = useRef(0);
  const load = useCallback(async (p = 1) => {
    const mine = ++ticket.current;
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await salesLeadsApi.list({
        search: search || undefined,
        temperature: temperature !== "all" ? temperature : undefined,
        status: status !== "all" ? status : undefined,
        assigned_to: owner !== "all" ? owner : undefined,
        sort: "code",
        page: p,
        limit: PAGE_SIZE,
      });
      if (mine !== ticket.current) return;
      const rows = res.data ?? [];
      // A lead added meanwhile shifts the pages by one; skip a row already shown.
      setItems((prev) => (p === 1 ? rows : [...prev, ...rows.filter((r) => !prev.some((x) => x.id === r.id))]));
      setTotal(res.pagination?.total ?? rows.length);
      setHasMore(res.pagination ? p < res.pagination.total_pages : false);
      setPage(p);
      setError(null);
    } catch (e) {
      if (mine !== ticket.current) return;
      const message = e instanceof Error ? e.message : "Could not load leads";
      if (p === 1) setError(message);
      toast.error(message);
    } finally {
      if (mine === ticket.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [search, temperature, status, owner]);

  useEffect(() => {
    void load(1);
  }, [load]);

  // The next page loads as the end of the list comes into view.
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = end.current;
    if (!el || !hasMore || loading || loadingMore) return;
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((x) => x.isIntersecting)) void load(page + 1);
    }, { rootMargin: "150px 0px" });
    seen.observe(el);
    return () => seen.disconnect();
  }, [hasMore, loading, loadingMore, page, load]);

  useEffect(() => {
    try {
      localStorage.setItem(OWNER_KEY, owner);
    } catch {
      /* Storage refused — the filter still works for this visit. */
    }
  }, [owner]);

  // Keep the filters shareable/bookmarkable.
  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("search", search);
    if (temperature !== "all") next.set("temperature", temperature);
    if (status !== "all") next.set("status", status);
    if (owner !== "all") next.set("owner", owner);
    setSearchParams(next, { replace: true });
  }, [search, temperature, status, owner, setSearchParams]);

  // Old links to ?new=1 open the new-lead page.
  const navigate = useNavigate();
  const [openOnArrival] = useState(() => searchParams.get("new") === "1");
  useEffect(() => { if (openOnArrival) navigate("/sales/leads/new", { replace: true }); }, [openOnArrival, navigate]);

  // The phone app (Diamond Fencing's phone design): search in the header, temperature chips,
  // then the leads as chat-style rows. Editing and deleting are on the lead itself.
  return (
    <SalesLayout>
      <div className="space-y-3">
        <HeroBar eyebrow={loading ? "Loading…" : hasMore ? `${items.length} of ${total} leads` : `${total} lead${total === 1 ? "" : "s"}`} title="Leads"
          right={<HeroAvatar name={me?.name} to="/sales/more" />}>
          <SearchBox onHero value={search} onChange={setSearch} placeholder="Search name, company, phone" />
        </HeroBar>
        <Chips value={temperature} onChange={setTemperature}
          options={[{ value: "all", label: "All" }, ...TEMPERATURES.map((t) => ({ value: t, label: humanise(t) }))]} />
        <div className="-mt-1 grid grid-cols-2 gap-2">
          {!viewAs && (
            <PhoneSelect label="Owner" value={owner} onChange={setOwner} options={[
              { value: "all", label: "All owners" },
              ...people.map((pp) => ({ value: String(pp.user_id), label: pp.name })),
              { value: "none", label: "Unassigned" },
            ]} />
          )}
          <PhoneSelect label="Status" value={status} onChange={setStatus}
            options={[{ value: "all", label: "All statuses" }, ...STATUSES.map((st) => ({ value: st, label: humanise(st) }))]} />
        </div>
        {loading ? <Loading /> : error ? (
          <Empty icon={Users} text={error} action={<Button variant="outline" onClick={() => void load(1)}>Try again</Button>} />
        ) : items.length === 0 ? (
          <Empty icon={Users} text={search || temperature !== "all" || status !== "all" ? "No leads match these filters." : "No leads yet."} />
        ) : (
          <>
            <List>
              {items.map((lead) => (
                <Row key={lead.id} to={`/sales/leads/${lead.id}`} avatar={<Avatar name={lead.company || lead.name} />}
                  title={lead.company || lead.name}
                  meta={lead.lead_code ?? undefined}
                  sub={<>
                    <span className="block truncate">
                      {[lead.contact_person || lead.name, humanise(lead.status), lead.next_followup_at ? `Follow-up ${shortDate(lead.next_followup_at)}` : null].filter(Boolean).join(" · ")}
                    </span>
                    {/* Where they came from, on a line of its own so it is never the part cut off. */}
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-primary">
                      <Megaphone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{lead.source ? sourceLabel(lead.source, lead.source_chapter) : "Source not recorded"}</span>
                    </span>
                  </>}
                  end={<TempPill value={lead.temperature} />} />
              ))}
            </List>
            <div ref={end} className="flex justify-center py-4 text-xs text-muted-foreground">
              {loadingMore ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
                : hasMore ? <button type="button" className="py-2 font-medium text-primary" onClick={() => void load(page + 1)}>Load more</button>
                : items.length > PAGE_SIZE ? `All ${total} leads shown` : null}
            </div>
          </>
        )}
      </div>
    </SalesLayout>
  );
}
