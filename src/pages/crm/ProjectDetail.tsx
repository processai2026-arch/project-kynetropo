import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity, Bug, CalendarDays, CircleDollarSign, ClipboardList, FolderKanban, Hash, History, IndianRupee,
  Pencil, Plus, Trash2, UserRound, Users, Wallet,
} from "lucide-react";
import { RecordDetailPage } from "@/components/RecordDetailPage";
import { RecordProfileHeader, ProfileLinkCard } from "@/components/RecordProfileHeader";
import { DetailStats, DetailWorkspace } from "@/components/DetailStats";
import { DetailTabs } from "@/components/DetailTabs";
import { DetailTimeline } from "@/components/DetailTimeline";
import { StatCard } from "@/components/StatCard";
import { SectionCard } from "@/components/SectionCard";
import { InlineField } from "@/components/InlineField";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { ActionDialog } from "@/components/ActionDialog";
import { WorkflowProgress } from "@/components/WorkflowProgress";
import { Field } from "@/components/Field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { useAuth } from "@/contexts/AuthContext";
import { useLoad } from "@/hooks/useLoad";
import { opsFinanceApi, opsProjectsApi } from "@/lib/api/ops";
import { formatDate, humanise } from "@/lib/format";
import { initialsOf } from "@/lib/initials";
import type { OpsPayment } from "@/types/ops";
import { HealthBadge, PROJECT_STAGES, PriorityBadge, rupees } from "./components/crm";
import { PAYMENT_MODES, PAYMENT_TYPES, PaymentDialog } from "./components/PaymentDialog";

const label = (options: { value: string; label: string }[], v: string) => options.find((o) => o.value === v)?.label ?? humanise(v);

export default function ProjectDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { userName } = useAuth();
  const { data: p, loading, error, reload } = useLoad(() => opsProjectsApi.get(id), [id]);
  const [tab, setTab] = useState("status");
  const [payOpen, setPayOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<OpsPayment | null>(null);
  const [removingPayment, setRemovingPayment] = useState<OpsPayment | null>(null);
  const [removing, setRemoving] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  if (error) return <p className="text-destructive">{error}</p>;

  const payments = p?.payments ?? [];
  const bugs = p?.bugs ?? [];
  const meetings = p?.meetings ?? [];
  const activity = p?.activity_log ?? [];
  const stages = p?.stage_history ?? [];
  const openPayment = (payment: OpsPayment | null) => { setEditingPayment(payment); setPayOpen(true); };

  return (
    <RecordDetailPage>
      <RecordProfileHeader
        backTo="/projects"
        backLabel="Projects"
        crumb={p?.name ?? "Project"}
        icon={FolderKanban}
        mark={p ? initialsOf(p.name) : undefined}
        loading={loading && !p}
        eyebrow={p ? `${p.project_code ?? "Project"} · created ${formatDate(p.created_at)}` : undefined}
        status={p && <HealthBadge value={p.health} />}
        title={p?.name ?? "Project"}
        subtitle={p && <><Users aria-hidden /><Link to={`/clients/${p.client_id}`} className="hover:text-primary">{p.client_code ? `${p.client_code} · ` : ""}{p.client_name}</Link></>}
        facts={p ? [
          { icon: Hash, label: "Project ID", value: p.project_code ?? "—" },
          { icon: UserRound, label: "Owner", value: p.owner || "—" },
          { icon: CalendarDays, label: "Deadline", value: p.deadline ? formatDate(p.deadline) : "—" },
          { icon: Activity, label: "Priority", value: <PriorityBadge value={p.priority} /> },
        ] : []}
        aside={p && <ProfileLinkCard icon={Users} label="Client" value={p.client_name ?? "—"} onClick={() => navigate(`/clients/${p.client_id}`)} />}
        actions={p && <>
          <Button onClick={() => openPayment(null)}><Plus className="h-4 w-4" /> Record payment</Button>
          <Button variant="outline" onClick={() => navigate(`/projects/${p.id}/edit`)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRemoving(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
        </>}
      />

      <DetailStats>
        <StatCard title="Quoted" value={p ? rupees(p.quoted) : "—"} subtitle="Agreed amount" icon={IndianRupee} accent="sky" subtitleColor="muted" />
        <StatCard title="Received" value={p ? rupees(p.received) : "—"} subtitle={`${payments.length} payment${payments.length === 1 ? "" : "s"}`} icon={Wallet} accent="violet" subtitleColor="muted" />
        <StatCard title="Balance" value={p ? rupees(p.balance) : "—"} subtitle={p && Number(p.balance) > 0 ? "Still to collect" : "Nothing owed"} icon={CircleDollarSign} accent="teal" subtitleColor="muted" />
        <StatCard title="Payment status" value={p ? humanise(p.payment_status) : "—"} subtitle={p?.collection_target_date ? `Target ${formatDate(p.collection_target_date)}` : "No target date"} icon={ClipboardList} accent="amber" subtitleColor="muted" />
      </DetailStats>

      {p && (
        <WorkflowProgress
          title="Project stage"
          steps={PROJECT_STAGES}
          current={p.stage}
          onMove={async (stage, note) => {
            await opsProjectsApi.update(p.id, { stage, stage_note: note, updated_by: userName } as never);
            await reload();
          }}
        />
      )}

      <DetailWorkspace
        main={<>
          <DetailTabs value={tab} onValueChange={setTab} ariaLabel="Project details" tabs={[
            { value: "status", label: "Status", icon: ClipboardList },
            { value: "payments", label: "Payments", icon: Wallet, count: payments.length },
            { value: "bugs", label: "Bugs", icon: Bug, count: bugs.length },
            { value: "meetings", label: "Meetings", icon: CalendarDays, count: meetings.length },
            { value: "activity", label: "Activity", icon: History, count: activity.length },
          ]} />

          {tab === "status" && p && (
            <SectionCard icon={ClipboardList} title="Current status"
              headerAction={<Button variant="outline" size="sm" onClick={() => setStatusOpen(true)}><Pencil className="h-4 w-4" /> Update</Button>}>
              <dl data-field-grid="" className="grid gap-2">
                <InlineField label="Current work" value={p.current_work || null} />
                <InlineField label="Next action" value={p.next_action || null} />
                <InlineField label="Next deadline" value={p.next_deadline ? formatDate(p.next_deadline) : null} />
                <InlineField label="Blocker" display={p.blocker ? <span className="text-red-600">{p.blocker}</span> : undefined} value={p.blocker || null} />
                <InlineField label="Founder note" value={p.founder_note || null} />
              </dl>
            </SectionCard>
          )}

          {tab === "payments" && p && (
            <SectionCard icon={Wallet} title="Payments" subtitle="Recorded here or on Finance — the same records" bodyPadding=""
              headerAction={<Button size="sm" onClick={() => openPayment(null)}><Plus className="h-4 w-4" /> Record payment</Button>}>
              <ScrollableX>
                <table className="w-full text-sm">
                  <thead><tr>
                    <th className="text-left">Date</th><th className="text-left">Type</th><th className="text-left">Mode</th>
                    <th className="text-left">Reference</th><th className="text-right">Amount</th><th />
                  </tr></thead>
                  <tbody>
                    {payments.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No payments yet</td></tr>}
                    {payments.map((pay) => (
                      <tr key={pay.id}>
                        <td className="whitespace-nowrap">{formatDate(pay.payment_date)}</td>
                        <td>{label(PAYMENT_TYPES, pay.type)}</td>
                        <td>{label(PAYMENT_MODES, pay.mode)}</td>
                        <td className="text-muted-foreground">{pay.reference || "—"}</td>
                        <td className="text-right font-medium tabular-nums text-emerald-700">{rupees(pay.amount)}</td>
                        <td className="w-10">
                          <RowActionsMenu ariaLabel={`Actions for payment of ${rupees(pay.amount)}`}>
                            <DropdownMenuItem onSelect={() => openPayment(pay)}><Pencil className="h-4 w-4" /> Edit payment</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setRemovingPayment(pay)}><Trash2 className="h-4 w-4" /> Delete payment</DropdownMenuItem>
                          </RowActionsMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableX>
            </SectionCard>
          )}

          {tab === "bugs" && p && (
            <SectionCard icon={Bug} title="Bugs" bodyPadding=""
              headerAction={<Button variant="outline" size="sm" onClick={() => navigate(`/bugs?project_id=${p.id}`)}>Open tracker</Button>}>
              <ScrollableX>
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left">Priority</th><th className="text-left">Bug</th><th className="text-left">Status</th></tr></thead>
                  <tbody>
                    {bugs.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No bugs</td></tr>}
                    {bugs.map((b) => (
                      <tr key={b.id} className="cursor-pointer" onClick={() => navigate(`/bugs/${b.id}`)}>
                        <td><Badge variant="outline" className="capitalize">{humanise(b.priority)}</Badge></td>
                        <td className="max-w-md truncate">{b.description}</td>
                        <td><Badge variant="outline" className="capitalize">{humanise(b.status)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableX>
            </SectionCard>
          )}

          {tab === "meetings" && (
            <SectionCard icon={CalendarDays} title="Meetings">
              {meetings.length === 0 ? <p className="text-sm text-muted-foreground">No meetings</p> : (
                <DetailTimeline items={meetings.map((m) => ({
                  label: humanise(m.type), at: m.date, description: m.outcome || undefined, tone: "done" as const,
                }))} />
              )}
            </SectionCard>
          )}

          {tab === "activity" && (
            <SectionCard icon={History} title="Activity">
              {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet</p> : (
                <DetailTimeline items={activity.map((a) => ({
                  label: a.description ?? "Updated", at: a.created_at, by: a.done_by || null, tone: "done" as const,
                }))} />
              )}
            </SectionCard>
          )}
        </>}
        side={p && <>
          <SectionCard icon={Wallet} title="Money">
            <dl data-field-grid="" className="grid gap-2">
              <InlineField label="Quoted" value={rupees(p.quoted)} />
              <InlineField label="Received" value={rupees(p.received)} />
              <InlineField label="Balance" display={<span className={Number(p.balance) > 0 ? "text-red-600" : "text-emerald-700"}>{rupees(p.balance)}</span>} value={rupees(p.balance)} />
              <InlineField label="Next trigger" value={p.next_collection_trigger || null} />
              <InlineField label="Target date" value={p.collection_target_date ? formatDate(p.collection_target_date) : null} />
            </dl>
          </SectionCard>
          <SectionCard icon={History} title="Stage history">
            {stages.length === 0 ? <p className="text-sm text-muted-foreground">No stage moves recorded</p> : (
              <DetailTimeline items={[...stages].reverse().map((s) => ({
                label: s.stage_name, at: s.completed_at, by: s.completed_by || null, description: s.notes || undefined, tone: "done" as const,
              }))} />
            )}
          </SectionCard>
        </>}
      />

      {p && <>
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          projects={[p]}
          payment={editingPayment}
          onSaved={() => { void reload(); setTab("payments"); }}
        />
        <ActionDialog
          open={removingPayment !== null}
          onOpenChange={(v) => { if (!v) setRemovingPayment(null); }}
          title="Delete this payment?"
          destructive
          confirmLabel="Delete payment"
          description={removingPayment && <p>{rupees(removingPayment.amount)} on {formatDate(removingPayment.payment_date)}. The project's balance goes back up and Finance drops it.</p>}
          onConfirm={async () => { if (removingPayment) { await opsFinanceApi.deletePayment(removingPayment.id); await reload(); } }}
          successMessage="Payment deleted"
        />
        <StatusDialog open={statusOpen} onOpenChange={setStatusOpen} project={p} userName={userName ?? ""} onSaved={reload} />
        <ActionDialog
          open={removing}
          onOpenChange={setRemoving}
          title={`Delete ${p.name}?`}
          destructive
          confirmLabel="Delete project"
          description={<p>This permanently deletes the project with its {payments.length} payment{payments.length === 1 ? "" : "s"} ({rupees(p.received)}), bugs, meetings, notes and credentials. Finance drops the payments. The client stays. This cannot be undone.</p>}
          onConfirm={async () => { await opsProjectsApi.remove(p.id); navigate("/projects", { replace: true }); }}
          successMessage="Project deleted"
        />
      </>}
    </RecordDetailPage>
  );
}

/** Current work, next action, blocker and founder note — the fields the team updates week to week. */
function StatusDialog({ open, onOpenChange, project, userName, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: number; current_work: string | null; next_action: string | null; next_deadline: string | null; blocker: string | null; founder_note: string | null };
  userName: string;
  onSaved: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({ current_work: "", next_action: "", next_deadline: "", blocker: "", founder_note: "" });
  useEffect(() => {
    if (open) setForm({
      current_work: project.current_work ?? "", next_action: project.next_action ?? "", next_deadline: project.next_deadline ?? "",
      blocker: project.blocker ?? "", founder_note: project.founder_note ?? "",
    });
  }, [open, project]);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <ActionDialog open={open} onOpenChange={onOpenChange} wide title="Update status" confirmLabel="Save status" successMessage="Status updated"
      onConfirm={async () => { await opsProjectsApi.update(project.id, { ...form, updated_by: userName } as never); await onSaved(); }}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Current work / situation" htmlFor="cw"><Textarea id="cw" rows={3} value={form.current_work} onChange={(e) => set("current_work", e.target.value)} /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Next action" htmlFor="na"><Textarea id="na" rows={2} value={form.next_action} onChange={(e) => set("next_action", e.target.value)} /></Field>
          <Field label="Next deadline" htmlFor="nd"><Input id="nd" type="date" value={form.next_deadline} onChange={(e) => set("next_deadline", e.target.value)} /></Field>
        </div>
        <Field label="Blocker" htmlFor="bl" hint="Anything stopping progress"><Textarea id="bl" rows={2} value={form.blocker} onChange={(e) => set("blocker", e.target.value)} /></Field>
        <Field label="Founder note (private)" htmlFor="fn"><Textarea id="fn" rows={2} value={form.founder_note} onChange={(e) => set("founder_note", e.target.value)} /></Field>
      </div>
    </ActionDialog>
  );
}
