import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, FolderKanban, IndianRupee, Megaphone, Pencil, Receipt, StickyNote, Tag, Trash2, UserRound } from "lucide-react";
import { RecordDetailPage } from "@/components/RecordDetailPage";
import { RecordProfileHeader } from "@/components/RecordProfileHeader";
import { DetailTabs } from "@/components/DetailTabs";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { SectionCard } from "@/components/SectionCard";
import { ActionDialog } from "@/components/ActionDialog";
import { Button } from "@/components/ui/button";
import { useLoad } from "@/hooks/useLoad";
import { useUrlTab } from "@/hooks/useUrlTab";
import { rowOpenProps, ROW_OPEN_CLASS } from "@/lib/rowNav";
import { opsFinanceApi } from "@/lib/api/ops";
import { formatDate, formatDateTime } from "@/lib/format";
import { rupees } from "@/pages/crm/components/crm";
import { categoryLabel, timeLabel } from "./components/ExpenseBits";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { ActionBar, Block, Loading, TopBar, usePhoneApp } from "@/components/phone/PhoneKit";

/** One expense: what, how much, when, what it is booked to, and notes. */
export default function ExpenseDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const phone = usePhoneApp();
  // The phone app keeps its own copy of these pages under /sales.
  const base = phone ? "/sales/expenses" : "/finance/expenses";
  const { data: e, loading, error } = useLoad(() => opsFinanceApi.expense(id), [id]);
  const [removing, setRemoving] = useState(false);
  const [tab, setTab] = useUrlTab(["expense", "notes", "category"] as const, "expense");
  // The rest of this category, for comparison.
  const { data: sameCategory } = useLoad(
    () => (e ? opsFinanceApi.expenses({ category: e.category }) : Promise.resolve({ data: [] })),
    [e?.category],
  );

  if (error) return <p className="text-destructive">{error}</p>;

  const others = (sameCategory ?? []).filter((x) => x.id !== e?.id);
  const rows: [string, React.ReactNode][] = e ? [
    ["Amount", <span className="font-semibold text-red-600">{rupees(e.amount)}</span>],
    ["Date", formatDate(e.date)],
    ["Time", timeLabel(e.time) || "—"],
    ["Category", categoryLabel(e.category)],
    ["What for", e.description || "—"],
    ["Project", e.project_id ? <Link to={`/finance/projects/${e.project_id}`} className="text-primary hover:underline">{e.project_code ? `${e.project_code} · ` : ""}{e.project_name ?? `Project ${e.project_id}`}</Link> : "—"],
    ["Pitch event", e.pitch_id ? <Link to={`/pitches/${e.pitch_id}`} className="text-primary hover:underline">{e.pitch_name ?? `Pitch ${e.pitch_id}`}</Link> : "—"],
    ["Added by", e.added_by || "—"],
    ["Entered on", formatDateTime(e.created_at)],
  ] : [];

  const removeDialog = e && (
        <ActionDialog
          open={removing}
          onOpenChange={setRemoving}
          title="Delete this expense?"
          destructive
          confirmLabel="Delete expense"
          description={<p>{rupees(e.amount)} on {formatDate(e.date)} ({categoryLabel(e.category)}). It comes out of Finance and this month's profit goes up by as much.</p>}
          onConfirm={async () => { await opsFinanceApi.deleteExpense(e.id); navigate(base, { replace: true }); }}
          successMessage="Expense deleted"
        />
  );

  if (phone) {
    return (
      <SalesLayout>
        <TopBar title={e ? rupees(e.amount) : "Expense"} sub={e ? categoryLabel(e.category) : undefined} back={base} />
        {!e ? <Loading /> : (
          <div className="space-y-4">
            <Block title="Expense" icon={IndianRupee}>
              <dl className="divide-y">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                    <dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </Block>
            <Block title="Notes" icon={StickyNote}>
              <p className="whitespace-pre-wrap px-4 pb-4 text-sm text-muted-foreground">{e.notes || "No notes."}</p>
            </Block>
          </div>
        )}
        {e && (
          <ActionBar>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12 text-base text-destructive" onClick={() => setRemoving(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
              <Button className="h-12 text-base" onClick={() => navigate(`${base}/${e.id}/edit`)}><Pencil className="h-4 w-4" /> Edit</Button>
            </div>
          </ActionBar>
        )}
        {removeDialog}
      </SalesLayout>
    );
  }

  return (
    <RecordDetailPage>
      <RecordProfileHeader
        backTo={base}
        backLabel="Expenses"
        crumb={e ? `Expense ${rupees(e.amount)}` : "Expense"}
        icon={Receipt}
        loading={loading && !e}
        eyebrow={e ? `Expense · ${categoryLabel(e.category)}` : undefined}
        title={e ? rupees(e.amount) : "Expense"}
        subtitle={e && <><Tag aria-hidden /><span>{e.description || categoryLabel(e.category)}</span></>}
        facts={e ? [
          { icon: CalendarDays, label: "Date", value: `${formatDate(e.date)}${e.time ? ` · ${timeLabel(e.time)}` : ""}` },
          { icon: Tag, label: "Category", value: categoryLabel(e.category) },
          { icon: e.pitch_id ? Megaphone : FolderKanban, label: e.pitch_id ? "Pitch event" : "Project", value: e.pitch_name ?? e.project_name ?? "—" },
          { icon: UserRound, label: "Added by", value: e.added_by || "—" },
        ] : []}
        actions={e && <>
          <Button variant="outline" onClick={() => navigate(`${base}/${e.id}/edit`)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRemoving(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
        </>}
      />

      {e && (
        <div className="space-y-4">
          <DetailTabs value={tab} onValueChange={setTab} ariaLabel="Expense details" tabs={[
            { value: "expense", label: "Expense", icon: IndianRupee },
            { value: "notes", label: "Notes", icon: StickyNote, count: e.notes ? 1 : 0 },
            { value: "category", label: `Other ${categoryLabel(e.category).toLowerCase()}`, icon: Tag, count: others.length },
          ]} />

          {tab === "expense" && (
            <SectionCard icon={IndianRupee} title="Expense">
              <table className="w-full text-sm"><tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}><th scope="row" className="w-40 text-left font-normal text-muted-foreground">{k}</th><td>{v}</td></tr>
                ))}
              </tbody></table>
            </SectionCard>
          )}

          {tab === "notes" && (
            <SectionCard icon={StickyNote} title="Notes"
              headerAction={<Button size="sm" variant="outline" onClick={() => navigate(`${base}/${e.id}/edit`)}><Pencil className="h-4 w-4" /> Edit notes</Button>}>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{e.notes || "No notes."}</p>
            </SectionCard>
          )}

          {tab === "category" && (
            <SectionCard icon={Tag} title={`${categoryLabel(e.category)} — other expenses`}
              subtitle={`${others.length} more, ${rupees(others.reduce((t, x) => t + Number(x.amount), 0))} in all`} bodyPadding="">
              <ScrollableX>
                <table className="w-full text-sm">
                  <thead><tr>
                    <th className="text-left">Date</th><th className="text-left">What for</th><th className="text-left">Project / event</th><th className="text-right">Amount</th>
                  </tr></thead>
                  <tbody>
                    {others.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No other expenses in this category</td></tr>}
                    {others.map((x) => (
                      <tr key={x.id} className={ROW_OPEN_CLASS} {...rowOpenProps(() => navigate(`${base}/${x.id}`))}>
                        <td className="whitespace-nowrap">{formatDate(x.date)}</td>
                        <td>{x.description || "—"}</td>
                        <td className="text-muted-foreground">{x.project_name ?? x.pitch_name ?? "—"}</td>
                        <td className="text-right font-medium tabular-nums text-red-600">{rupees(x.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableX>
            </SectionCard>
          )}
        </div>
      )}

      {removeDialog}
    </RecordDetailPage>
  );
}
