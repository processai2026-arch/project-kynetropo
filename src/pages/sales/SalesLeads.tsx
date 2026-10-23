import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { salesLeadsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { humanise } from "@/components/sales/SalesBits";
import { Avatar, Chips, Empty, HeroAvatar, HeroBar, List, Loading, PhoneSelect, Row, SearchBox, shortDate, usePhoneApp } from "@/components/phone/PhoneKit";
import { TempPill } from "./phone/SalesPhoneHome";
import { LeadFormDialog } from "@/components/sales/LeadFormDialog";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [temperature, setTemperature] = useState(searchParams.get("temperature") ?? "all");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  // A link with ?owner= wins for that visit; otherwise the last choice stands.
  const [owner, setOwner] = useState(() => searchParams.get("owner") ?? storedOwner());

  const people = useTeamMembers(true);
  const [formOpen, setFormOpen] = useState(false);
  // null = adding; a lead = editing that one. The dialog is the same either way.
  const [editingLead, setEditingLead] = useState<SalesLead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesLeadsApi.list({
        search: search || undefined,
        temperature: temperature !== "all" ? temperature : undefined,
        status: status !== "all" ? status : undefined,
        assigned_to: owner !== "all" ? owner : undefined,
        limit: 200,
      });
      setItems(res.data ?? []);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load leads";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, temperature, status, owner]);

  useEffect(() => {
    void load();
  }, [load]);

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

  /*
   * The dashboard's "Add New Lead" links here with ?new=1.
   *
   * Read on the first render rather than in an effect: the filter-sync effect
   * above rewrites the URL as soon as it runs, and would have dropped the
   * parameter before anything had a chance to act on it — which is why that
   * button has been landing on the list and doing nothing.
   */
  const [openOnArrival] = useState(() => searchParams.get("new") === "1");
  const handledArrival = useRef(false);
  useEffect(() => {
    if (handledArrival.current || !openOnArrival) return;
    // Permissions arrive a moment after mount; keep waiting until they do.
    if (!can("sales.leads.create")) return;
    handledArrival.current = true;
    setEditingLead(null);
    setFormOpen(true);
  }, [openOnArrival, can]);

  const leadForm = (      <LeadFormDialog
      open={formOpen}
      lead={editingLead}
      onClose={() => {
        setFormOpen(false);
        setEditingLead(null);
      }}
      onSaved={(saved) => {
        // Patch the row in place on an edit so the list does not jump; a new
        // lead has to come from the server to land in the right filter.
        if (editingLead) {
          setItems((prev) => prev.map((l) => (l.id === saved.id ? { ...l, ...saved } : l)));
        } else {
          void load();
        }
      }}
    />
  );

  // The phone app (Diamond Fencing's phone design): search in the header, temperature chips,
  // then the leads as chat-style rows. Editing and deleting are on the lead itself.
  return (
    <SalesLayout>
      <div className="space-y-3">
        <HeroBar eyebrow={loading ? "Loading…" : `${items.length} lead${items.length === 1 ? "" : "s"}`} title="Leads"
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
          <Empty icon={Users} text={error} action={<Button variant="outline" onClick={() => void load()}>Try again</Button>} />
        ) : items.length === 0 ? (
          <Empty icon={Users} text={search || temperature !== "all" || status !== "all" ? "No leads match these filters." : "No leads yet."} />
        ) : (
          <List>
            {items.map((lead) => (
              <Row key={lead.id} to={`/sales/leads/${lead.id}`} avatar={<Avatar name={lead.company || lead.name} />}
                title={lead.company || lead.name}
                meta={lead.next_followup_at ? shortDate(lead.next_followup_at) : undefined}
                sub={[lead.contact_person || lead.name, humanise(lead.status)].filter(Boolean).join(" · ")}
                end={<TempPill value={lead.temperature} />} />
            ))}
          </List>
        )}
        {leadForm}
      </div>
    </SalesLayout>
  );
}
