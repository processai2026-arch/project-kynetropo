import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Bug, CalendarClock, CalendarDays, CheckSquare, CircleDollarSign, FolderKanban, Hash, History, IndianRupee,
  Mail, Megaphone, Pencil, Phone, Plus, Trash2, UserRound, Users, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { RecordDetailPage } from "@/components/RecordDetailPage";
import { RecordProfileHeader } from "@/components/RecordProfileHeader";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ScrollableX } from "@/components/ui/scrollable-x";
import { useAuth } from "@/contexts/AuthContext";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { useLoad } from "@/hooks/useLoad";
import { opsClientsApi, opsFinanceApi, opsProjectsApi } from "@/lib/api/ops";
import { salesFollowupsApi } from "@/lib/api/sales";
import { formatDate, humanise, todayIso } from "@/lib/format";
import { initialsOf } from "@/lib/initials";
import { rowOpenProps, ROW_OPEN_CLASS } from "@/lib/rowNav";
import { cn } from "@/lib/utils";
import type { OpsPayment, OpsProject } from "@/types/ops";
import { CLIENT_STAGES, HealthBadge, PriorityBadge, rupees } from "./components/crm";
import { PAYMENT_MODES, PAYMENT_TYPES, PaymentDialog } from "./components/PaymentDialog";

const label = (options: { value: string; label: string }[], v: string) => options.find((o) => o.value === v)?.label ?? humanise(v);

const OUTCOMES: Record<string, string> = {
  interested: "Interested",
  not_interested: "Not interested",
  not_picked_up: "Not picked up",
  completed: "Completed",
};

export default function ClientDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { userName } = useAuth();
  const { can } = useSalesAccess();
  const { data: c, loading, error, reload } = useLoad(() => opsClientsApi.get(id), [id]);
  const [projects, setProjects] = useState<OpsProject[]>([]);
  const [tab, setTab] = useState("projects");
  const [payOpen, setPayOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<OpsPayment | null>(null);
  const [removingPayment, setRemovingPayment] = useState<OpsPayment | null>(null);
  const [removing, setRemoving] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);

  // Every project of this client — the detail endpoint only carries the newest.
  const loadProjects = () => opsProjectsApi.list().then((r) => setProjects((r.data ?? []).filter((p) => p.client_id === id))).catch(() => undefined);
  useEffect(() => { void loadProjects(); }, [id]);
  const refresh = async () => { await reload(); await loadProjects(); };

  const payments = (c?.payments ?? []) as OpsPayment[];
  const meetings = c?.meetings ?? [];
  const bugs = c?.bugs ?? [];
  const checklist = c?.checklist ?? [];
  const timeline = c?.timeline ?? [];
  const followups = c?.followups ?? [];
  const showFollowups = Boolean(c?.sales_lead) && can("sales.followups.view");
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const money = projects.reduce((m, p) => ({
    quoted: m.quoted + Number(p.quoted), received: m.received + Number(p.received), balance: m.balance + Number(p.balance),
  }), { quoted: 0, received: 0, balance: 0 });
  const doneItems = checklist.filter((i) => i.is_done).length;

  if (error) return <p className="text-destructive">{error}</p>;

  const openPayment = (payment: OpsPayment | null) => {
    if (!payment && projects.length === 0) { toast.error("Create a project first — a payment is recorded against a project."); return; }
    setEditingPayment(payment);
    setPayOpen(true);
  };

  return (
    <RecordDetailPage>
      <RecordProfileHeader
        backTo="/clients"
        backLabel="Clients"
        crumb={c?.name ?? "Client"}
        icon={Users}
        mark={c ? initialsOf(c.name) : undefined}
        loading={loading && !c}
        eyebrow={c ? `${c.client_code ?? "Client"} · added ${formatDate(c.created_at)}` : undefined}
        status={c && <HealthBadge value={c.health} />}
        title={c?.name ?? "Client"}
        subtitle={c && <><UserRound aria-hidden /><span>{c.owner ? `Owner: ${c.owner}` : "No owner yet"} · {c.stage}</span></>}
        facts={c ? [
          { icon: Hash, label: "Client ID", value: c.client_code ?? "—" },
          { icon: Phone, label: "Call", value: c.phone || "—", href: c.phone ? `tel:${c.phone}` : undefined },
          { icon: Mail, label: "Email", value: c.email || "—", href: c.email ? `mailto:${c.email}` : undefined },
          { icon: Megaphone, label: "Source", value: c.source || "—" },
        ] : []}
        actions={c && <>
          <Button onClick={() => openPayment(null)}><Plus className="h-4 w-4" /> Record payment</Button>
          <Button variant="outline" onClick={() => navigate(`/clients/${c.id}/edit`)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRemoving(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
        </>}
      />

      <DetailStats>
        <StatCard title="Projects" value={String(projects.length)} subtitle={projects.length ? projects.map((p) => p.project_code).filter(Boolean).join(", ") : "None yet"} icon={FolderKanban} accent="sky" subtitleColor="muted" />
        <StatCard title="Quoted" value={rupees(money.quoted)} subtitle="Across all projects" icon={IndianRupee} accent="violet" subtitleColor="muted" />
        <StatCard title="Received" value={rupees(money.received)} subtitle={`${payments.length} payment${payments.length === 1 ? "" : "s"}`} icon={Wallet} accent="teal" subtitleColor="muted" />
        <StatCard title="Balance" value={rupees(money.balance)} subtitle={money.balance > 0 ? "Still to collect" : "Nothing owed"} icon={CircleDollarSign} accent="amber" subtitleColor="muted" />
      </DetailStats>

      {c && (
        <WorkflowProgress
          title="Client stage"
          steps={CLIENT_STAGES}
          current={c.stage}
          onMove={async (stage, note) => {
            await opsClientsApi.advanceStage(c.id, stage, userName || "", note);
            await refresh();
          }}
        />
      )}

      <DetailWorkspace
        main={<>
          <DetailTabs value={tab} onValueChange={setTab} ariaLabel="Client details" tabs={[
            { value: "projects", label: "Projects", icon: FolderKanban, count: projects.length },
            { value: "payments", label: "Payments", icon: Wallet, count: payments.length },
            { value: "meetings", label: "Meetings", icon: CalendarDays, count: meetings.length },
            ...(showFollowups ? [{ value: "followups", label: "Follow-ups", icon: CalendarClock, count: followups.filter((f) => f.status === "pending").length }] : []),
            { value: "bugs", label: "Bugs", icon: Bug, count: bugs.length },
            { value: "checklist", label: "Checklist", icon: CheckSquare, count: checklist.length - doneItems },
            { value: "timeline", label: "Timeline", icon: History },
          ]} />

          {tab === "projects" && c && (
            <SectionCard icon={FolderKanban} title="Projects" bodyPadding=""
              headerAction={<Button size="sm" onClick={() => navigate(`/projects/new?client=${c.id}`)}><Plus className="h-4 w-4" /> New project</Button>}>
              <ScrollableX>
                <table className="w-full text-sm">
                  <thead><tr>
                    <th className="text-left">Project ID</th><th className="text-left">Project</th><th className="text-left">Stage</th>
                    <th className="text-left">Health</th><th className="text-left">Priority</th><th className="text-right">Quoted</th><th className="text-right">Balance</th>
                  </tr></thead>
                  <tbody>
                    {projects.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No project yet</td></tr>}
                    {projects.map((p) => (
                      <tr key={p.id} className={ROW_OPEN_CLASS} {...rowOpenProps(() => navigate(`/projects/${p.id}`))}>
                        <td className="font-mono">{p.project_code ?? "—"}</td>
                        <td className="font-medium">{p.name}</td>
                        <td className="text-xs">{p.stage}</td>
                        <td><HealthBadge value={p.health} /></td>
                        <td><PriorityBadge value={p.priority} /></td>
                        <td className="text-right tabular-nums">{rupees(p.quoted)}</td>
                        <td className={cn("text-right tabular-nums", Number(p.balance) > 0 ? "text-red-600" : "text-emerald-700")}>{rupees(p.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableX>
            </SectionCard>
          )}

          {tab === "payments" && (
            <SectionCard icon={Wallet} title="Payments" subtitle="Recorded here, on a project or on Finance — the same records" bodyPadding=""
              headerAction={<Button size="sm" onClick={() => openPayment(null)}><Plus className="h-4 w-4" /> Record payment</Button>}>
              <ScrollableX>
                <table className="w-full text-sm">
                  <thead><tr>
                    <th className="text-left">Date</th><th className="text-left">Project</th><th className="text-left">Type</th>
                    <th className="text-left">Mode</th><th className="text-left">Reference</th><th className="text-right">Amount</th><th />
                  </tr></thead>
                  <tbody>
                    {payments.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No payments yet</td></tr>}
                    {payments.map((pay) => {
                      const pr = projectName.get(pay.project_id);
                      return (
                        <tr key={pay.id}>
                          <td className="whitespace-nowrap">{formatDate(pay.payment_date)}</td>
                          <td>{pr ? <Link className="hover:text-primary" to={`/projects/${pr.id}`}>{pr.project_code ? `${pr.project_code} · ` : ""}{pr.name}</Link> : "—"}</td>
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
                      );
                    })}
                  </tbody>
                </table>
              </ScrollableX>
            </SectionCard>
          )}

          {tab === "meetings" && (
            <SectionCard icon={CalendarDays} title="Meetings" headerAction={<Button variant="outline" size="sm" onClick={() => navigate("/meetings")}>Schedule</Button>}>
              <DetailTimeline empty="No meetings yet" items={meetings.map((m) => ({
                label: humanise(m.type),
                at: m.date,
                tone: "done" as const,
                description: [m.agenda && `Agenda: ${m.agenda}`, m.outcome && `Outcome: ${m.outcome}`, m.next_action && `Next: ${m.next_action}`, m.next_followup && `Follow-up: ${m.next_followup}`].filter(Boolean).join("\n") || undefined,
              }))} />
            </SectionCard>
          )}

          {tab === "followups" && showFollowups && c?.sales_lead && (
            <SectionCard icon={CalendarClock} title="Follow-ups"
              subtitle={`Against lead ${c.sales_lead.lead_code || c.sales_lead.company || c.sales_lead.name}, which this client was converted from`}
              headerAction={can("sales.followups.create") && <Button size="sm" onClick={() => setFollowupOpen(true)}><Plus className="h-4 w-4" /> Add</Button>}>
              <DetailTimeline empty="No follow-ups yet" items={followups.map((f) => {
                const overdue = f.status === "pending" && f.due_date < todayIso();
                return {
                  label: f.status === "completed" ? (OUTCOMES[f.outcome] ?? "Done") : overdue ? "Overdue" : "Pending",
                  at: `${f.due_date}${f.due_time ? ` ${f.due_time}` : ""}`,
                  by: f.assigned_to_name ? `Owner: ${f.assigned_to_name}` : null,
                  description: [f.purpose, f.outcome_notes].filter(Boolean).join("\n") || undefined,
                  tone: f.status === "completed" ? "done" as const : overdue ? "warn" as const : "active" as const,
                };
              })} />
              <Link to="/sales/followups" className="mt-3 block text-xs text-primary hover:underline">Open the follow-up queue →</Link>
            </SectionCard>
          )}

          {tab === "bugs" && (
            <SectionCard icon={Bug} title="Open bugs" bodyPadding="">
              <ScrollableX>
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left">Priority</th><th className="text-left">Bug</th><th className="text-left">Status</th></tr></thead>
                  <tbody>
                    {bugs.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No open bugs</td></tr>}
                    {bugs.map((b) => (
                      <tr key={b.id} className={ROW_OPEN_CLASS} {...rowOpenProps(() => navigate(`/bugs/${b.id}`))}>
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

          {tab === "checklist" && c && (
            <SectionCard icon={CheckSquare} title="Document checklist" subtitle={`${doneItems} of ${checklist.length} done`}>
              <ul className="divide-y">
                {checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2.5">
                    <Checkbox
                      id={`chk-${item.id}`}
                      checked={!!item.is_done}
                      onCheckedChange={async (v) => {
                        try { await opsClientsApi.checklistUpdate(c.id, item.id, v === true, userName || undefined); await reload(); }
                        catch { toast.error("Could not update the checklist"); }
                      }}
                    />
                    <label htmlFor={`chk-${item.id}`} className={cn("flex-1 cursor-pointer text-sm", item.is_done && "text-muted-foreground line-through")}>{item.item_name}</label>
                    {item.completed_date && <span className="text-xs text-muted-foreground">{formatDate(item.completed_date)}</span>}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {tab === "timeline" && (
            <SectionCard icon={History} title="Timeline">
              <DetailTimeline empty="No activity yet" items={timeline.map((e) => ({
                label: e.description,
                at: e.created_at,
                by: e.done_by || "System",
                tone: "done" as const,
              }))} />
            </SectionCard>
          )}
        </>}
        side={c && <>
          <SectionCard icon={UserRound} title="Client information"
            headerAction={<Button variant="outline" size="sm" onClick={() => navigate(`/clients/${c.id}/edit`)}><Pencil className="h-4 w-4" /> Edit</Button>}>
            <dl data-field-grid="" className="grid gap-2">
              <InlineField label="Client ID" value={c.client_code} />
              <InlineField label="Owner" value={c.owner || null} />
              <InlineField label="Stage" value={c.stage} />
              <InlineField label="Source" value={c.source || null} />
              <InlineField label="Using now" value={c.current_software || null} />
              <InlineField label="Why us" value={c.switch_reason || null} />
              <InlineField label="Notes" value={c.notes || null} />
            </dl>
          </SectionCard>
          {c.sales_lead && (
            <SectionCard icon={Megaphone} title="From sales">
              <Link to={`/sales/leads/${c.sales_lead.id}`} className="text-sm text-primary hover:underline">
                Lead {c.sales_lead.lead_code || c.sales_lead.name}
              </Link>
            </SectionCard>
          )}
        </>}
      />

      {c && <>
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          projects={projects}
          payment={editingPayment}
          onSaved={() => { void refresh(); setTab("payments"); }}
        />
        <ActionDialog
          open={removingPayment !== null}
          onOpenChange={(v) => { if (!v) setRemovingPayment(null); }}
          title="Delete this payment?"
          destructive
          confirmLabel="Delete payment"
          description={removingPayment && <p>{rupees(removingPayment.amount)} on {formatDate(removingPayment.payment_date)}. The project's balance goes back up and Finance drops it.</p>}
          onConfirm={async () => { if (removingPayment) { await opsFinanceApi.deletePayment(removingPayment.id); await refresh(); } }}
          successMessage="Payment deleted"
        />
        <ActionDialog
          open={removing}
          onOpenChange={setRemoving}
          title={`Delete ${c.name}?`}
          destructive
          confirmLabel="Delete client"
          description={<div className="space-y-2">
            <p>
              This permanently deletes the client
              {projects.length > 0 && <> and its {projects.length === 1 ? "project" : `${projects.length} projects`} ({projects.map((p) => p.name).join(", ")})</>}
              , with {payments.length} payment{payments.length === 1 ? "" : "s"} ({rupees(money.received)}), meetings, bugs and the checklist. Finance drops the payments.
            </p>
            {c.sales_lead && <p>Lead {c.sales_lead.lead_code || c.sales_lead.name} goes back to being a lead.</p>}
            <p>This cannot be undone.</p>
          </div>}
          onConfirm={async () => { await opsClientsApi.remove(c.id); navigate("/clients", { replace: true }); }}
          successMessage="Client deleted"
        />
        {c.sales_lead && (
          <FollowupDialog open={followupOpen} onOpenChange={setFollowupOpen} leadId={c.sales_lead.id}
            leadName={c.sales_lead.company || c.sales_lead.name} onSaved={reload} />
        )}
      </>}
    </RecordDetailPage>
  );
}

/**
 * Books a follow-up against the lead this client was converted from — the same
 * record the sales team works from, so it lands in that owner's queue.
 */
function FollowupDialog({ open, onOpenChange, leadId, leadName, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadName: string;
  onSaved: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({ due_date: todayIso(), due_time: "", purpose: "" });
  useEffect(() => { if (open) setForm({ due_date: todayIso(), due_time: "", purpose: "" }); }, [open]);
  return (
    <ActionDialog open={open} onOpenChange={onOpenChange} title="Add follow-up" confirmLabel="Add follow-up" successMessage="Follow-up scheduled"
      description={`Goes into the sales follow-up queue against ${leadName}'s lead.`}
      disabled={!form.due_date}
      onConfirm={async () => {
        await salesFollowupsApi.create({ lead_id: leadId, due_date: form.due_date, due_time: form.due_time || undefined, purpose: form.purpose });
        await onSaved();
      }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="fu-date" required><Input id="fu-date" type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} /></Field>
        <Field label="Time" htmlFor="fu-time"><Input id="fu-time" type="time" value={form.due_time} onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))} /></Field>
        <Field label="Purpose" htmlFor="fu-purpose" className="col-span-2">
          <Input id="fu-purpose" placeholder="Check the install went ok, chase renewal…" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
        </Field>
      </div>
    </ActionDialog>
  );
}
