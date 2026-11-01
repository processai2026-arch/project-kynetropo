import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { opsPitchesApi } from "@/lib/api/ops";
import { formatDate } from "@/lib/format";
import { rowOpenProps, ROW_OPEN_CLASS } from "@/lib/rowNav";
import type { OpsPitch, OpsPitchLead } from "@/types/ops";
import {
  CalendarDays, Calculator, FileText, IndianRupee, MapPin, Megaphone, Pencil, StickyNote, Tag, Trash2, TrendingUp, Users,
} from "lucide-react";
import { toast } from "sonner";
import { RecordDetailPage } from "@/components/RecordDetailPage";
import { RecordProfileHeader } from "@/components/RecordProfileHeader";
import { DetailStats, DetailWorkspace } from "@/components/DetailStats";
import { StatCard } from "@/components/StatCard";
import { SectionCard } from "@/components/SectionCard";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { PITCH_TYPES, PitchDeleteDialog, PitchFormDialog, RoiText, inr } from "./components/PitchDialogs";

const QUOTE_STYLES: Record<string, string> = {
  sent:     "bg-amber-50 text-amber-700 border-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
};
const QUOTE_WORD: Record<string, string> = { sent: "waiting", accepted: "accepted", rejected: "rejected" };

/** Where a lead stands: the customer's stage once there is one, else the lead's status. */
function whereNow(l: OpsPitchLead): string {
  if (l.stage) return l.stage;
  return (l.lead_status ?? "").replace(/_/g, " ");
}

export default function PitchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData]       = useState<OpsPitch | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    opsPitchesApi.get(Number(id))
      .then(res => setData(res.data))
      .catch(() => toast.error("Failed to load pitch"))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!loading && !data) return <div className="p-8 text-muted-foreground">Pitch not found</div>;

  const leads = data?.leads ?? [];
  const won = leads.filter((l) => l.won);
  const open = (l: OpsPitchLead) => navigate(l.lead_id ? `/sales/leads/${l.lead_id}` : `/clients/${l.client_id}`);

  return (
    <RecordDetailPage>
      <RecordProfileHeader
        backTo="/pitches"
        backLabel="Pitches & Marketing"
        crumb={data?.name ?? "Pitch event"}
        icon={Megaphone}
        loading={loading && !data}
        eyebrow={data ? `${PITCH_TYPES[data.type] ?? data.type} · ${formatDate(data.date)}` : undefined}
        title={data?.name ?? "Pitch event"}
        subtitle={data && <><MapPin aria-hidden /><span>{[data.venue, data.city].filter(Boolean).join(", ") || "Place not recorded"}{data.created_by ? ` · added by ${data.created_by}` : ""}</span></>}
        facts={data ? [
          { icon: CalendarDays, label: "Date", value: formatDate(data.date) },
          { icon: Tag, label: "Type", value: PITCH_TYPES[data.type] ?? data.type },
          { icon: MapPin, label: "City", value: data.city || "—" },
          { icon: IndianRupee, label: "Spend", value: inr(data.spend) },
        ] : []}
        actions={data && <>
          <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRemoving(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
        </>}
      />

      <DetailStats>
        <StatCard title="Leads" value={String(data?.leads_count ?? 0)}
          subtitle={data?.cost_per_lead != null ? `${inr(data.cost_per_lead)} a lead` : "From this event"} icon={Users} accent="sky" subtitleColor="muted" />
        <StatCard title="Quoted" value={inr(data?.quoted_value ?? 0)}
          subtitle={`${data?.quoted_count ?? 0} quotation${data?.quoted_count === 1 ? "" : "s"} sent`} icon={FileText} accent="violet" subtitleColor="muted" />
        <StatCard title="Revenue" value={inr(data?.revenue ?? 0)}
          subtitle={`${data?.converted ?? 0} won · ${data?.conversion_pct ?? 0}%`} icon={IndianRupee} accent="teal" subtitleColor="muted" />
        <StatCard title="ROI" value={data?.roi != null ? `${data.roi >= 0 ? "+" : ""}${data.roi}%` : "—"}
          subtitle={`On ${inr(data?.spend ?? 0)} spent`} icon={TrendingUp} accent="amber" subtitleColor="muted" />
      </DetailStats>

      <DetailWorkspace
        main={
          <SectionCard
            title={`Leads from this event (${leads.length})`}
            subtitle="Leads and customers whose source is this event — pick it in Source when adding one"
            icon={Users}
            bodyPadding=""
          >
            <ScrollableX>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {["Lead","Where now","Quotation","Revenue","Received"].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">
                      No leads from this event yet. Choose it under Source when adding a lead or a client.
                    </td></tr>
                  )}
                  {leads.map((l) => (
                    <tr key={`${l.lead_id ?? "c"}-${l.client_id ?? "l"}`} className={cn("border-b hover:bg-muted/30 transition-colors", ROW_OPEN_CLASS)} {...rowOpenProps(() => open(l))}>
                      <td className="py-3 px-4">
                        <Link to={l.lead_id ? `/sales/leads/${l.lead_id}` : `/clients/${l.client_id}`} className="font-medium text-primary hover:underline">{l.name}</Link>
                        <div className="text-xs text-muted-foreground">
                          {[l.lead_code, l.client_code, l.company].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={cn("text-xs capitalize whitespace-nowrap",
                          l.won ? "border-emerald-200 bg-emerald-50 text-emerald-700" : l.lost ? "border-red-200 bg-red-50 text-red-600" : "")}>
                          {whereNow(l) || "—"}
                        </Badge>
                        {l.assigned_to_name && <div className="mt-0.5 text-xs text-muted-foreground">{l.assigned_to_name}</div>}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {l.quotes > 0 ? <>
                          <span className="text-card-foreground">{l.quote_amount != null ? inr(l.quote_amount) : "No amount"}</span>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            v{l.quote_version}
                            {l.quote_status && <Badge className={cn("border px-1.5 py-0 text-[10px]", QUOTE_STYLES[l.quote_status])}>{QUOTE_WORD[l.quote_status]}</Badge>}
                          </div>
                        </> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {l.won ? <>
                          <span className="font-medium text-emerald-700">{inr(l.revenue)}</span>
                          <div className="text-xs text-muted-foreground">
                            {l.revenue_from === "project" ? `project quoted${l.projects > 1 ? ` (${l.projects})` : ""}` : l.revenue_from === "quotation" ? "accepted quote" : "no amount yet"}
                          </div>
                        </> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-card-foreground">{l.received > 0 ? inr(l.received) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableX>
          </SectionCard>
        }
        side={data && <>
          <SectionCard title="How the ROI is worked out" icon={Calculator}>
            <dl className="space-y-2.5 text-sm">
              {[
                { label: "Spend", value: inr(data.spend), note: "Travel, food, registration" },
                { label: "Revenue", value: inr(data.revenue), note: `${won.length} won: the project's quoted price, or the accepted quotation` },
                { label: "ROI", value: <RoiText roi={data.roi} />, note: data.spend > 0 ? `(${inr(data.revenue)} − ${inr(data.spend)}) ÷ ${inr(data.spend)}` : "Add the spend to see it" },
              ].map((r) => (
                <div key={r.label} className="border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className="font-medium text-card-foreground">{r.value}</dd>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.note}</p>
                </div>
              ))}
            </dl>
          </SectionCard>
          <SectionCard title="Money" icon={IndianRupee}>
            <dl className="space-y-2 text-sm">
              {[
                { label: "Received so far", value: inr(data.received ?? 0) },
                { label: "Waiting on a quote", value: inr(data.pipeline ?? 0) },
                { label: "Lost", value: String(data.lost ?? 0) },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{r.label}</dt>
                  <dd className="font-medium text-card-foreground">{r.value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
          {data.description && (
            <SectionCard title="Notes" icon={StickyNote}>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.description}</p>
            </SectionCard>
          )}
        </>}
      />

      <PitchFormDialog open={editing} onOpenChange={setEditing} editing={data} onSaved={() => load()} />
      <PitchDeleteDialog pitch={removing ? data : null} onOpenChange={setRemoving}
        onDeleted={() => { setRemoving(false); navigate("/pitches", { replace: true }); }} />
    </RecordDetailPage>
  );
}
