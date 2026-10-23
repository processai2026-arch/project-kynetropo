import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Eye, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/PageHeader";
import { RecordListPage } from "@/components/RecordListPage";
import { ListShell, type Column } from "@/components/ListShell";
import { NameCell, IconCell } from "@/components/ListCells";
import { NativeSelect } from "@/components/Field";
import { useConfirm } from "@/components/ConfirmDialog";
import { LeadFormDialog } from "@/components/sales/LeadFormDialog";
import { ConvertLeadDialog } from "@/components/sales/ConvertLeadDialog";
import { LeadStatusBadge, TemperatureBadge, formatDate, humanise, sourceLabel } from "@/components/sales/SalesBits";
import { useClientList } from "@/hooks/useClientList";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { salesLeadsApi } from "@/lib/api/sales";
import { stopRowOpen } from "@/lib/rowNav";
import type { LeadStatus, SalesLead } from "@/types/sales";

const TEMPERATURES = ["hot", "warm", "cold"] as const;
const STATUSES: LeadStatus[] = [
  "new", "contacted", "qualified", "meeting_scheduled",
  "proposal", "onboarding", "converted", "lost",
];
/** Stages a row's dropdown may set directly; onboarding and conversion create the client. */
const PLAIN_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "meeting_scheduled", "proposal", "lost"];
const TEMP_RANK: Record<string, number> = { hot: 0, warm: 1, cold: 2 };

/** The owner filter outlives the visit (shared with the phone app's list). */
const OWNER_KEY = "kyn_sales_lead_owner";
function storedOwner(): string {
  try {
    return localStorage.getItem(OWNER_KEY) ?? "all";
  } catch {
    return "all";
  }
}

/** Every lead the server will show, a page of 200 at a time — the list then searches, sorts and pages them here. */
async function loadAllLeads(owner: string): Promise<SalesLead[]> {
  const rows: SalesLead[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await salesLeadsApi.list({ assigned_to: owner !== "all" ? owner : undefined, page, limit: 200 });
    rows.push(...(res.data ?? []));
    if (page >= (res.pagination?.total_pages ?? 1)) break;
  }
  return rows;
}

/**
 * A lead's stage, changed from its row. The plain stages save at once;
 * "Convert to client…" opens the conversion popup, where the client's details
 * are checked before the client is made.
 */
function StageCell({
  lead,
  canEdit,
  canConvert,
  onChange,
}: {
  lead: SalesLead;
  canEdit: boolean;
  canConvert: boolean;
  onChange: (lead: SalesLead, status: LeadStatus) => void;
}) {
  if (lead.status === "converted") {
    return (
      <div className="flex flex-col items-start gap-1">
        <LeadStatusBadge value="converted" />
        {lead.converted_client_id && (
          <Link to={`/clients/${lead.converted_client_id}`} className="text-xs text-primary hover:underline">Open client</Link>
        )}
      </div>
    );
  }
  const onboarding = lead.status === "onboarding";
  const options = [
    ...(canEdit && !onboarding ? PLAIN_STATUSES : []),
    ...(canConvert && !onboarding ? (["onboarding"] as LeadStatus[]) : []),
  ];
  if (!canConvert && (!canEdit || onboarding)) return <LeadStatusBadge value={lead.status} />;
  return (
    // The menu opens in a portal, and its clicks still bubble to the row through React — stop them here.
    <div {...stopRowOpen<HTMLDivElement>()} className="w-44">
      <Select value={lead.status} onValueChange={(v) => onChange(lead, v as LeadStatus)}>
        <SelectTrigger className="h-8 text-xs" aria-label={`Stage of ${lead.company || lead.name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {onboarding && <SelectItem value="onboarding">Onboarding</SelectItem>}
          {options.map((s) => <SelectItem key={s} value={s}>{humanise(s)}</SelectItem>)}
          {canConvert && (
            <>
              <SelectSeparator />
              <SelectItem value="converted" className="font-medium text-emerald-700">Convert to client…</SelectItem>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Leads on a computer: the CRM register — one row per lead, 25 to 200 a page,
 * sortable columns, a row that opens the lead, and the stage changed in the row.
 */
export function LeadsRegister() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, viewAs } = useSalesAccess();
  const confirm = useConfirm();
  const people = useTeamMembers(true);
  // A link with ?owner= wins for that visit; otherwise the last choice stands.
  const [owner, setOwner] = useState(() => searchParams.get("owner") ?? storedOwner());
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<SalesLead | null>(null);
  const [converting, setConverting] = useState<SalesLead | null>(null);

  const list = useClientList<SalesLead>(() => loadAllLeads(owner), {
    searchText: (l) => [l.lead_code, l.name, l.company, l.contact_person, l.phone, l.email, l.source, l.source_chapter],
    // Newest on top: lead codes run oldest to newest (LD-0001 is the first lead), so the
    // list opens on the highest code; any column header re-sorts it.
    defaultSort: "code",
    defaultDir: "desc",
    sorts: {
      code: (l) => Number((l.lead_code ?? "").replace(/\D/g, "")) || l.id,
      name: (l) => (l.company || l.name).toLowerCase(),
      source: (l) => sourceLabel(l.source, l.source_chapter).toLowerCase(),
      temperature: (l) => TEMP_RANK[l.temperature],
      stage: (l) => STATUSES.indexOf(l.status),
      owner: (l) => l.assigned_to_name?.toLowerCase(),
      followup: (l) => l.next_followup_at,
      added: (l) => l.acquired_on ?? l.created_at,
    },
    filters: {
      temperature: (l, v) => l.temperature === v,
      status: (l, v) => l.status === v,
    },
  });
  const { reload, setFilters, setSearch } = list;

  // Links from the dashboard carry ?temperature=, ?status= and ?search=; read once on arrival.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    setFilters({ temperature: searchParams.get("temperature") ?? "", status: searchParams.get("status") ?? "" });
    if (searchParams.get("search")) setSearch(searchParams.get("search") ?? "");
  }, [searchParams, setFilters, setSearch]);

  // The owner filter is the server's (it decides whose leads come back), so a change reloads.
  const firstOwner = useRef(true);
  useEffect(() => {
    try { localStorage.setItem(OWNER_KEY, owner); } catch { /* the filter still works for this visit */ }
    if (firstOwner.current) { firstOwner.current = false; return; }
    reload();
  }, [owner, reload]);

  // Keep the filters shareable/bookmarkable.
  useEffect(() => {
    if (!arrived.current) return;
    const next = new URLSearchParams();
    if (list.search) next.set("search", list.search);
    if (list.filters.temperature) next.set("temperature", list.filters.temperature);
    if (list.filters.status) next.set("status", list.filters.status);
    if (owner !== "all") next.set("owner", owner);
    setSearchParams(next, { replace: true });
  }, [list.search, list.filters.temperature, list.filters.status, owner, setSearchParams]);

  // The dashboard's "Add New Lead" links here with ?new=1 — read on the first render, before the sync above rewrites the URL.
  const [openOnArrival] = useState(() => searchParams.get("new") === "1");
  const handledArrival = useRef(false);
  useEffect(() => {
    if (handledArrival.current || !openOnArrival || !can("sales.leads.create")) return;
    handledArrival.current = true;
    setEditingLead(null);
    setFormOpen(true);
  }, [openOnArrival, can]);

  const canEdit = can("sales.leads.edit");
  const canConvert = can("sales.leads.convert");

  const changeStage = async (lead: SalesLead, status: LeadStatus) => {
    if (status === lead.status) return;
    if (status === "converted") { setConverting(lead); return; }
    try {
      if (status === "onboarding") await salesLeadsApi.startOnboarding(lead.id);
      else await salesLeadsApi.update(lead.id, { status });
      toast.success(`${lead.company || lead.name} moved to ${humanise(status)}`);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the stage");
    }
  };

  const remove = async (lead: SalesLead) => {
    const ok = await confirm({
      title: `Delete ${lead.company || lead.name}?`,
      description:
        "Every call, follow-up and meeting on this lead goes with it, along with its timeline and discussion.\nThis cannot be undone. To take a lead out of the pipeline without losing its history, mark it lost instead.",
      confirmLabel: "Delete lead",
      destructive: true,
    });
    if (!ok) return;
    try {
      await salesLeadsApi.remove(lead.id);
      toast.success("Lead deleted");
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the lead");
    }
  };

  const ownerOptions = useMemo(() => [
    { value: "all", label: "All owners" },
    ...people.map((p) => ({ value: String(p.user_id), label: p.name })),
    { value: "none", label: "Unassigned" },
  ], [people]);

  const columns: Column<SalesLead>[] = [
    { key: "code", label: "Lead ID", sortKey: "code", render: (l) => <span className="whitespace-nowrap font-mono text-sm">{l.lead_code || "—"}</span> },
    { key: "name", label: "Lead", sortKey: "name", render: (l) => <NameCell id={l.id} name={l.company || l.name} sub={l.contact_person || (l.company ? l.name : undefined)} /> },
    { key: "phone", label: "Contact", render: (l) => <IconCell icon={Phone} primary={l.phone || "—"} secondary={l.email || undefined} /> },
    { key: "source", label: "Source", sortKey: "source", render: (l) => <span className="text-xs">{sourceLabel(l.source, l.source_chapter) || "—"}</span> },
    { key: "temperature", label: "Temperature", sortKey: "temperature", render: (l) => <TemperatureBadge value={l.temperature} /> },
    { key: "stage", label: "Stage", sortKey: "stage", render: (l) => <StageCell lead={l} canEdit={canEdit} canConvert={canConvert} onChange={changeStage} /> },
    { key: "owner", label: "Owner", sortKey: "owner", render: (l) => l.assigned_to_name || "—" },
    { key: "followup", label: "Next follow-up", sortKey: "followup", render: (l) => (l.next_followup_at ? formatDate(l.next_followup_at.slice(0, 10)) : "—") },
    { key: "added", label: "Came in", sortKey: "added", render: (l) => formatDate((l.acquired_on ?? l.created_at).slice(0, 10)) },
  ];

  const total = list.pagination?.total;

  return (
    <RecordListPage>
      <PageHeader
        title="Leads"
        subtitle={total !== undefined ? `${total} lead${total === 1 ? "" : "s"}${list.isFiltered ? " matching" : ""}` : undefined}
        action={can("sales.leads.create") ? (
          <Button onClick={() => { setEditingLead(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add lead</Button>
        ) : undefined}
      />
      <ListShell
        list={list}
        columns={columns}
        searchPlaceholder="Lead ID, name, company, phone…"
        itemLabel="leads"
        rowHref={(l) => `/sales/leads/${l.id}`}
        rowLabel={(l) => l.company || l.name}
        empty="No leads match"
        filters={<>
          <NativeSelect className="w-40" value={list.filters.temperature ?? ""} placeholder="All temperatures"
            options={TEMPERATURES.map((t) => ({ value: t, label: humanise(t) }))} onChange={(v) => list.setFilter("temperature", v)} />
          <NativeSelect className="w-44" value={list.filters.status ?? ""} placeholder="All stages"
            options={STATUSES.map((s) => ({ value: s, label: humanise(s) }))} onChange={(v) => list.setFilter("status", v)} />
          {/* Hidden while reading a colleague's view, where the banner has already said whose leads these are. */}
          {!viewAs && <NativeSelect className="w-44" value={owner} options={ownerOptions} onChange={(v) => setOwner(v || "all")} />}
        </>}
        rowActions={(l) => (
          <>
            <DropdownMenuItem onSelect={() => navigate(`/sales/leads/${l.id}`)}><Eye className="h-4 w-4" /> View lead</DropdownMenuItem>
            {canEdit && <DropdownMenuItem onSelect={() => { setEditingLead(l); setFormOpen(true); }}><Pencil className="h-4 w-4" /> Edit lead</DropdownMenuItem>}
            {canConvert && l.status !== "converted" && (
              <DropdownMenuItem onSelect={() => setConverting(l)}><CheckCircle2 className="h-4 w-4" /> Convert to client…</DropdownMenuItem>
            )}
            {/* A converted lead has a client pointing at its history, so the server refuses to delete it. */}
            {can("sales.leads.assign") && l.status !== "converted" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void remove(l)}><Trash2 className="h-4 w-4" /> Delete lead</DropdownMenuItem>
              </>
            )}
          </>
        )}
      />

      <LeadFormDialog
        open={formOpen}
        lead={editingLead}
        onClose={() => { setFormOpen(false); setEditingLead(null); }}
        onSaved={() => reload()}
      />
      <ConvertLeadDialog
        lead={converting}
        open={converting !== null}
        onOpenChange={(v) => { if (!v) setConverting(null); }}
        onConverted={() => { setConverting(null); reload(); }}
      />
    </RecordListPage>
  );
}
