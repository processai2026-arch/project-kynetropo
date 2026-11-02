import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, FolderKanban, IndianRupee, Megaphone, Pencil, Receipt, StickyNote, Tag, Trash2, UserRound } from "lucide-react";
import { RecordDetailPage } from "@/components/RecordDetailPage";
import { RecordProfileHeader } from "@/components/RecordProfileHeader";
import { DetailWorkspace } from "@/components/DetailStats";
import { SectionCard } from "@/components/SectionCard";
import { ActionDialog } from "@/components/ActionDialog";
import { Button } from "@/components/ui/button";
import { useLoad } from "@/hooks/useLoad";
import { opsFinanceApi } from "@/lib/api/ops";
import { formatDate, formatDateTime } from "@/lib/format";
import { rupees } from "@/pages/crm/components/crm";
import { categoryLabel } from "./components/ExpenseBits";

/** One expense: what, how much, when, what it is booked to, and notes. */
export default function ExpenseDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: e, loading, error } = useLoad(() => opsFinanceApi.expense(id), [id]);
  const [removing, setRemoving] = useState(false);

  if (error) return <p className="text-destructive">{error}</p>;

  const rows: [string, React.ReactNode][] = e ? [
    ["Amount", <span className="font-semibold text-red-600">{rupees(e.amount)}</span>],
    ["Date", formatDate(e.date)],
    ["Category", categoryLabel(e.category)],
    ["What for", e.description || "—"],
    ["Project", e.project_id ? <Link to={`/finance/projects/${e.project_id}`} className="text-primary hover:underline">{e.project_code ? `${e.project_code} · ` : ""}{e.project_name ?? `Project ${e.project_id}`}</Link> : "—"],
    ["Pitch event", e.pitch_id ? <Link to={`/pitches/${e.pitch_id}`} className="text-primary hover:underline">{e.pitch_name ?? `Pitch ${e.pitch_id}`}</Link> : "—"],
    ["Added by", e.added_by || "—"],
    ["Entered on", formatDateTime(e.created_at)],
  ] : [];

  return (
    <RecordDetailPage>
      <RecordProfileHeader
        backTo="/finance/expenses"
        backLabel="Expenses"
        crumb={e ? `Expense ${rupees(e.amount)}` : "Expense"}
        icon={Receipt}
        loading={loading && !e}
        eyebrow={e ? `Expense · ${categoryLabel(e.category)}` : undefined}
        title={e ? rupees(e.amount) : "Expense"}
        subtitle={e && <><Tag aria-hidden /><span>{e.description || categoryLabel(e.category)}</span></>}
        facts={e ? [
          { icon: CalendarDays, label: "Date", value: formatDate(e.date) },
          { icon: Tag, label: "Category", value: categoryLabel(e.category) },
          { icon: e.pitch_id ? Megaphone : FolderKanban, label: e.pitch_id ? "Pitch event" : "Project", value: e.pitch_name ?? e.project_name ?? "—" },
          { icon: UserRound, label: "Added by", value: e.added_by || "—" },
        ] : []}
        actions={e && <>
          <Button variant="outline" onClick={() => navigate(`/finance/expenses/${e.id}/edit`)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRemoving(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
        </>}
      />

      {e && (
        <DetailWorkspace
          main={<SectionCard icon={IndianRupee} title="Expense">
            <table className="w-full text-sm"><tbody>
              {rows.map(([k, v]) => (
                <tr key={k}><th scope="row" className="w-40 text-left font-normal text-muted-foreground">{k}</th><td>{v}</td></tr>
              ))}
            </tbody></table>
          </SectionCard>}
          side={<SectionCard icon={StickyNote} title="Notes">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{e.notes || "No notes."}</p>
          </SectionCard>}
        />
      )}

      {e && (
        <ActionDialog
          open={removing}
          onOpenChange={setRemoving}
          title="Delete this expense?"
          destructive
          confirmLabel="Delete expense"
          description={<p>{rupees(e.amount)} on {formatDate(e.date)} ({categoryLabel(e.category)}). It comes out of Finance and this month's profit goes up by as much.</p>}
          onConfirm={async () => { await opsFinanceApi.deleteExpense(e.id); navigate("/finance/expenses", { replace: true }); }}
          successMessage="Expense deleted"
        />
      )}
    </RecordDetailPage>
  );
}
