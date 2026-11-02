import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, CreditCard, FolderKanban, IndianRupee, Pencil, ShieldCheck, StickyNote, Tag, Trash2, Users, Wallet } from "lucide-react";
import { RecordDetailPage } from "@/components/RecordDetailPage";
import { RecordProfileHeader, ProfileLinkCard } from "@/components/RecordProfileHeader";
import { DetailWorkspace } from "@/components/DetailStats";
import { SectionCard } from "@/components/SectionCard";
import { ActionDialog } from "@/components/ActionDialog";
import { Button } from "@/components/ui/button";
import { useLoad } from "@/hooks/useLoad";
import { opsFinanceApi } from "@/lib/api/ops";
import { formatDate, formatDateTime, humanise } from "@/lib/format";
import { rupees } from "@/pages/crm/components/crm";
import { PAYMENT_MODES, PAYMENT_TYPES, PaymentDialog } from "@/pages/crm/components/PaymentDialog";

const label = (options: { value: string; label: string }[], v: string) => options.find((o) => o.value === v)?.label ?? humanise(v);

/** One payment: who paid, for what, how, and what it did to the project (or AMC). */
export default function PaymentDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: p, loading, error, reload } = useLoad(() => opsFinanceApi.payment(id), [id]);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (error) return <p className="text-destructive">{error}</p>;

  const isAmc = p?.type === "amc";
  const rows: [string, React.ReactNode][] = p ? [
    ["Amount", <span className="font-semibold text-emerald-700">{rupees(p.amount)}</span>],
    ["Paid on", formatDate(p.payment_date)],
    ["For", label(PAYMENT_TYPES, p.type)],
    ["Mode", label(PAYMENT_MODES, p.mode)],
    ["Reference", p.reference || "—"],
    ["Client", p.client_name ? <Link to={`/clients/${p.client_id}`} className="text-primary hover:underline">{p.client_code ? `${p.client_code} · ` : ""}{p.client_name}</Link> : "—"],
    ["Project", p.project_name ? <Link to={`/finance/projects/${p.project_id}`} className="text-primary hover:underline">{p.project_code ? `${p.project_code} · ` : ""}{p.project_name}</Link> : "—"],
    ["Recorded by", p.recorded_by || "—"],
    ["Entered on", formatDateTime(p.created_at)],
  ] : [];
  if (p && isAmc && p.amc_from && p.amc_to) rows.splice(3, 0, ["AMC year", `${formatDate(p.amc_from)} – ${formatDate(p.amc_to)}`]);

  return (
    <RecordDetailPage>
      <RecordProfileHeader
        backTo="/finance?tab=payments"
        backLabel="Income"
        crumb={p ? `Payment ${rupees(p.amount)}` : "Payment"}
        icon={Wallet}
        loading={loading && !p}
        eyebrow={p ? `${label(PAYMENT_TYPES, p.type)} payment · ${formatDate(p.payment_date)}` : undefined}
        title={p ? rupees(p.amount) : "Payment"}
        subtitle={p && <><Users aria-hidden /><span>{p.client_name ?? "—"}{p.client_company ? ` · ${p.client_company}` : ""} · {p.project_name ?? "—"}</span></>}
        facts={p ? [
          { icon: CalendarDays, label: "Paid on", value: formatDate(p.payment_date) },
          { icon: Tag, label: "For", value: label(PAYMENT_TYPES, p.type) },
          { icon: CreditCard, label: "Mode", value: label(PAYMENT_MODES, p.mode) },
          { icon: IndianRupee, label: "Reference", value: p.reference || "—" },
        ] : []}
        aside={p && <ProfileLinkCard icon={FolderKanban} label="Project money" value={p.project_name ?? "—"} onClick={() => navigate(`/finance/projects/${p.project_id}`)} />}
        actions={p && <>
          <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRemoving(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
        </>}
      />

      {p && (
        <DetailWorkspace
          main={<>
            <SectionCard icon={Wallet} title="Payment">
              <table className="w-full text-sm"><tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}><th scope="row" className="w-40 text-left font-normal text-muted-foreground">{k}</th><td>{v}</td></tr>
                ))}
              </tbody></table>
            </SectionCard>
            {p.notes && (
              <SectionCard icon={StickyNote} title="Notes">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.notes}</p>
              </SectionCard>
            )}
          </>}
          side={isAmc ? (
            <SectionCard icon={ShieldCheck} title="AMC">
              {p.amc ? (
                <div className="space-y-2 text-sm">
                  <p>{rupees(p.amc.amount)} a year · next due {formatDate(p.amc.due_date)}</p>
                  <p className="text-muted-foreground">AMC money is not part of the project's quoted amount or balance.</p>
                  {p.amc_current && <p className="text-muted-foreground">This is the AMC's latest collection — deleting it puts the AMC back to how it was before.</p>}
                  <Button size="sm" variant="outline" onClick={() => navigate(`/amc/${p.amc!.id}`)}>Open AMC</Button>
                </div>
              ) : <p className="text-sm text-muted-foreground">Not linked to an AMC.</p>}
            </SectionCard>
          ) : (
            <SectionCard icon={FolderKanban} title="Project money">
              <table className="w-full text-sm"><tbody>
                <tr><th scope="row" className="text-left font-normal text-muted-foreground">Quoted</th><td className="text-right tabular-nums">{rupees(p.project_quoted ?? 0)}</td></tr>
                <tr><th scope="row" className="text-left font-normal text-muted-foreground">Received</th><td className="text-right tabular-nums text-emerald-700">{rupees(p.project_received ?? 0)}</td></tr>
                <tr><th scope="row" className="text-left font-normal text-muted-foreground">Balance</th><td className="text-right tabular-nums text-red-600">{rupees(p.project_balance ?? 0)}</td></tr>
                <tr><th scope="row" className="text-left font-normal text-muted-foreground">Status</th><td className="text-right">{humanise(p.project_payment_status ?? "")}</td></tr>
              </tbody></table>
            </SectionCard>
          )}
        />
      )}

      {p && <>
        <PaymentDialog open={editing} onOpenChange={setEditing} payment={p}
          projects={[{ id: p.project_id, client_id: p.client_id, name: p.project_name ?? "", project_code: p.project_code }]}
          onSaved={() => void reload()} />
        <ActionDialog
          open={removing}
          onOpenChange={setRemoving}
          title="Delete this payment?"
          destructive
          confirmLabel="Delete payment"
          description={<p>
            {rupees(p.amount)} on {formatDate(p.payment_date)}.{" "}
            {isAmc
              ? (p.amc_current ? "The AMC goes back to how it was before this was collected." : "The AMC itself is not changed.")
              : "The project's received amount goes down and its balance goes back up."}
          </p>}
          onConfirm={async () => { await opsFinanceApi.deletePayment(p.id); navigate("/finance?tab=payments", { replace: true }); }}
          successMessage="Payment deleted"
        />
      </>}
    </RecordDetailPage>
  );
}
