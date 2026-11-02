import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarClock, CalendarDays, FileText, FolderKanban, IndianRupee, Pencil, Phone, RotateCcw, ShieldCheck, StickyNote,
  Trash2, Users, Wallet,
} from "lucide-react";
import { RecordDetailPage } from "@/components/RecordDetailPage";
import { RecordProfileHeader, ProfileLinkCard } from "@/components/RecordProfileHeader";
import { DetailStats, DetailWorkspace } from "@/components/DetailStats";
import { StatCard } from "@/components/StatCard";
import { SectionCard } from "@/components/SectionCard";
import { ActionDialog } from "@/components/ActionDialog";
import { Button } from "@/components/ui/button";
import { useLoad } from "@/hooks/useLoad";
import { opsAmcApi } from "@/lib/api/ops";
import { formatDate } from "@/lib/format";
import { rupees } from "@/pages/crm/components/crm";
import type { OpsAmcPayment } from "@/types/ops";
import { AmcCollectDialog, AmcFormDialog, AmcSheetDialog, AmcStatusBadge, AmcUsageDialog, dueText } from "./components/AmcDialogs";
import { AmcContractTable, AmcPaymentsTable, AmcPriceTable, AmcRevertDialog } from "./components/AmcTables";

/** One AMC: what is due, collecting it, reverting a collection, and every year's payment. */
export default function AmcDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: a, loading, error, reload } = useLoad(() => opsAmcApi.get(id), [id]);
  const [collecting, setCollecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [usage, setUsage] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reverting, setReverting] = useState<OpsAmcPayment | null>(null);

  if (error) return <p className="text-destructive">{error}</p>;

  const payments = a?.payments ?? [];
  const collected = payments.reduce((s, p) => s + p.amount, 0);
  const latest = payments.find((p) => p.current) ?? null;
  const hasUsage = !!a && ((a.user_plans?.length ?? 0) > 0 || !!a.storage_gb);

  return (
    <RecordDetailPage>
      <RecordProfileHeader
        backTo="/amc"
        backLabel="AMC"
        crumb={a ? `${a.client_name} · ${a.project_name}` : "AMC"}
        icon={ShieldCheck}
        loading={loading && !a}
        eyebrow={a ? `AMC · ${a.first_year_free ? "from the 2nd year" : "from the 1st year"} · since ${formatDate(a.contract_start)}` : undefined}
        status={a && <AmcStatusBadge status={a.status} />}
        title={a ? `${a.client_name}${a.client_company ? ` · ${a.client_company}` : ""}` : "AMC"}
        subtitle={a && <><FolderKanban aria-hidden /><span>{a.project_code ? `${a.project_code} · ` : ""}{a.project_name}</span></>}
        facts={a ? [
          { icon: IndianRupee, label: "A year", value: rupees(a.amount) },
          { icon: CalendarDays, label: "This year", value: `${formatDate(a.start_date)} – ${formatDate(a.renewal_date)}` },
          { icon: CalendarClock, label: "Next due", value: <>{formatDate(a.due_date)} <span className="text-xs">{dueText(a.days_until_due)}</span></> },
          { icon: Phone, label: "Call", value: a.client_phone || "—", href: a.client_phone ? `tel:${a.client_phone}` : undefined },
        ] : []}
        aside={a && <ProfileLinkCard icon={FolderKanban} label="Project" value={a.project_name ?? "—"} onClick={() => navigate(`/projects/${a.project_id}`)} />}
        actions={a && <>
          <Button onClick={() => setCollecting(true)}><Wallet className="h-4 w-4" /> {a.term_paid ? "Collect renewal" : "Collect this year"}</Button>
          {latest && <Button variant="outline" onClick={() => setReverting(latest)}><RotateCcw className="h-4 w-4" /> Revert last collection</Button>}
          <Button variant="outline" onClick={() => setSheet(true)}><FileText className="h-4 w-4" /> Sheet</Button>
          {hasUsage && <Button variant="outline" onClick={() => setUsage(true)}><Users className="h-4 w-4" /> Users & storage</Button>}
          <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRemoving(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
        </>}
      />

      <DetailStats>
        <StatCard title="Per year" value={a ? rupees(a.amount) : "—"} subtitle={a && a.amount !== a.base_amount ? `Base ${rupees(a.base_amount)} + users and storage` : "The AMC price"} icon={IndianRupee} accent="sky" subtitleColor="muted" />
        <StatCard title="Due now" value={a && (!a.term_paid || (a.days_until_due ?? 99) <= 30) ? rupees(a.amount) : rupees(0)}
          subtitle={a ? `${a.term_paid ? "Renewal" : "This year"} on ${formatDate(a.due_date)}` : undefined} icon={CalendarClock} accent="amber" subtitleColor="muted" />
        <StatCard title="Collected so far" value={rupees(collected)} subtitle={`${payments.length} payment${payments.length === 1 ? "" : "s"}`} icon={Wallet} accent="teal" subtitleColor="muted" />
        <StatCard title="This year" value={a ? (!a.term_paid ? "Not paid" : a.in_free_year ? "Free" : "Paid") : "—"}
          subtitle={a ? `${formatDate(a.start_date)} – ${formatDate(a.renewal_date)}` : undefined} icon={CalendarDays} accent="violet" subtitleColor="muted" />
      </DetailStats>

      {a && (
        <DetailWorkspace
          main={<>
            <SectionCard icon={ShieldCheck} title="Contract">
              <AmcContractTable amc={a} />
            </SectionCard>
            <SectionCard icon={IndianRupee} title="Price a year" subtitle="Base, plus what extra users and storage add" bodyPadding="">
              <AmcPriceTable amc={a} />
            </SectionCard>
            <SectionCard icon={Wallet} title={`Payments (${payments.length})`} subtitle="Each year's AMC payment — the latest can be reverted" bodyPadding="">
              <AmcPaymentsTable payments={payments} onRevert={setReverting} />
            </SectionCard>
          </>}
          side={<>
            <SectionCard icon={StickyNote} title="How it works">
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
                <li><b className="text-card-foreground">Collect</b> records the payment in Finance. Once this year is paid, the next collection renews it for another year.</li>
                <li><b className="text-card-foreground">Revert</b> undoes the latest collection: the payment leaves Finance and the AMC's year and due date go back.</li>
                <li>AMC money is never part of the project's quoted amount or balance.</li>
              </ul>
            </SectionCard>
          </>}
        />
      )}

      {a && <>
        <AmcCollectDialog open={collecting} onOpenChange={setCollecting} amc={a} onSaved={() => void reload()} />
        {/* Edited to "No AMC" removes it: back to the list then. */}
        <AmcFormDialog open={editing} onOpenChange={setEditing} amc={a}
          onSaved={() => { opsAmcApi.get(a.id).then(() => reload(), () => navigate("/amc", { replace: true })); }} />
        <AmcUsageDialog open={usage} onOpenChange={setUsage} amc={a} onSaved={() => void reload()} />
        <AmcSheetDialog amc={sheet ? a : null} onClose={() => setSheet(false)} />
        <AmcRevertDialog amc={reverting ? a : null} payment={reverting} onOpenChange={(v) => { if (!v) setReverting(null); }}
          onDone={() => { setReverting(null); void reload(); }} />
        <ActionDialog
          open={removing}
          onOpenChange={setRemoving}
          title="Delete this AMC?"
          destructive
          confirmLabel="Delete AMC"
          description={<p>
            {a.client_name} · {a.project_name}, {rupees(a.amount)} a year.
            {!a.renewed && a.payment_id ? " Its first-year payment is taken out of Finance too." : " Payments already recorded stay in Finance."}
          </p>}
          onConfirm={async () => { await opsAmcApi.remove(a.id); navigate("/amc", { replace: true }); }}
          successMessage="AMC deleted"
        />
      </>}
    </RecordDetailPage>
  );
}
