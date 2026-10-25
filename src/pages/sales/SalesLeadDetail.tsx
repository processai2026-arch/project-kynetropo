import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Building2, CalendarClock, CalendarPlus, CalendarX, CheckCircle2, ChevronRight, ExternalLink,
  Mail, Megaphone, MessageCircle, MessageSquareQuote, MonitorCog, Pencil, Phone, Thermometer, Trash2, Undo2, UserCheck, Users, XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesCallsApi, salesFollowupsApi, salesLeadsApi, salesMeetingsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { RecordDetailPage } from "@/components/RecordDetailPage";
import { LogCallDialog } from "@/components/sales/LogCallDialog";
import { MeetingFormDialog, MeetingOutcomeDialog } from "@/components/sales/MeetingDialogs";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  FollowupEditDialog,
  FollowupEditNote,
  canEditFollowup,
} from "@/components/sales/FollowupEditDialog";
import { FollowupCompleteDialog } from "@/components/sales/FollowupCompleteDialog";
import { FollowupCloseDialog } from "@/components/sales/FollowupCloseDialog";
import { CommentButton, CommentThread, CommentThreadDialog } from "@/components/sales/CommentThread";
import {
  LeadStatusBadge, MeetingLink, TemperatureBadge,
  formatDate, formatDateTime, formatTime, humanise, sourceLabel,
} from "@/components/sales/SalesBits";
import type {
  CommentEntityType, LeadTemperature, SalesFollowup, SalesMeeting,
  SalesLeadDetail as LeadDetail,
} from "@/types/sales";
import { RecordProfileHeader } from "@/components/RecordProfileHeader";
import { ActionBar, Avatar, BarButton, Block, List, Loading, Pill, Row, TopBar, shortDate, usePhoneApp, type Tone } from "@/components/phone/PhoneKit";
import { TempPill, dueAt } from "./phone/SalesPhoneHome";
import { PhonePipeline, PhoneQuotation, QuotationCard, quotationSummary } from "@/components/sales/QuotationRounds";
import { CLIENT_STAGES } from "@/pages/crm/components/crm";
import type { ProfileFact } from "@/components/RecordProfileHeader";
import { DetailStats } from "@/components/DetailStats";
import { StatCard } from "@/components/StatCard";
import { DetailTimeline } from "@/components/DetailTimeline";
import type { TimelineItem } from "@/components/DetailTimeline";
import { cn } from "@/lib/utils";

/**
 * Today, from the local clock. toISOString() is UTC, which east of Greenwich
 * names yesterday all evening — the follow-up date this pre-fills would then be
 * a day in the past.
 */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type DialogKind = "call" | "meeting" | "followup" | "temperature" | "meeting_outcome" | null;

/** A lead's way to becoming a customer, as the phone app's pipeline shows it. */
const LEAD_STEPS: { status: string; label: string }[] = [
  { status: "new", label: "New" },
  { status: "contacted", label: "Contacted" },
  { status: "qualified", label: "Qualified" },
  { status: "meeting_scheduled", label: "Meeting" },
  { status: "proposal", label: "Quotation" },
  { status: "onboarding", label: "Onboarding" },
  { status: "converted", label: "Customer" },
];
const statusLabel = (status: string) => LEAD_STEPS.find((s) => s.status === status)?.label ?? humanise(status);

/** Where the lead stands, in the phone app's colours. */
const STATUS_TONE: Record<string, Tone> = {
  new: "sky", contacted: "primary", qualified: "violet", meeting_scheduled: "violet",
  proposal: "warning", onboarding: "warning", converted: "success", lost: "danger",
};

/** One of the round buttons under the lead's name — call, WhatsApp, e-mail, meeting. */
function QuickAction({ icon: Icon, label, href, onClick }: { icon: LucideIcon; label: string; href?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </>
  );
  const cls = "flex flex-col items-center gap-1.5 rounded-xl py-1 active:bg-muted/70";
  return href
    ? <a href={href} className={cls} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>{body}</a>
    : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

/** A round icon button at the end of a phone row. */
function RowButton({ icon: Icon, label, onClick, href, tone = "primary" }: { icon: LucideIcon; label: string; onClick?: () => void; href?: string; tone?: "primary" | "success" | "muted" }) {
  const cls = cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
    tone === "success" ? "bg-emerald-500/10 text-emerald-700 active:bg-emerald-500/20"
      : tone === "muted" ? "bg-muted text-muted-foreground active:bg-muted/70"
      : "bg-primary/10 text-primary active:bg-primary/20");
  return href
    ? <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className={cls}><Icon className="h-5 w-5" /></a>
    : <button type="button" aria-label={label} title={label} onClick={onClick} className={cls}><Icon className="h-5 w-5" /></button>;
}

function Field({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="break-words text-sm text-card-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function SalesLeadDetail() {
  const { id } = useParams();
  const leadId = Number(id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, me } = useSalesAccess();
  const phone = usePhoneApp();
  const confirm = useConfirm();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [editingFollowup, setEditingFollowup] = useState<SalesFollowup | null>(null);
  /** The follow-up being completed. Same dialog as the follow-ups page: the
      answer is worth the same here, and a bare "Done" recorded none of it. */
  const [completingFollowup, setCompletingFollowup] = useState<SalesFollowup | null>(null);
  /** The follow-up being closed as no longer needed. */
  const [closingFollowup, setClosingFollowup] = useState<SalesFollowup | null>(null);
  /** The phone's activity list shows the latest few until asked for the rest. */
  const [allActivity, setAllActivity] = useState(false);
  const [thread, setThread] = useState<{ type: CommentEntityType; id: number; title: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [outcomeMeeting, setOutcomeMeeting] = useState<SalesMeeting | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<SalesMeeting | null>(null);

  const [followupForm, setFollowupForm] = useState({ due_date: today(), due_time: "", purpose: "" });

  const load = useCallback(async () => {
    if (!Number.isFinite(leadId) || leadId <= 0) {
      setError("Invalid lead");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await salesLeadsApi.get(leadId);
      setLead(data);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load the lead";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Deep link from the dashboard's "Log Call" button.
  useEffect(() => {
    if (searchParams.get("action") === "call" && lead && can("sales.calls.create")) {
      setDialog("call");
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, lead, can, setSearchParams]);

  const closeDialog = () => setDialog(null);

  const handleAddFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await salesFollowupsApi.create({
        lead_id: leadId,
        due_date: followupForm.due_date,
        due_time: followupForm.due_time || undefined,
        purpose: followupForm.purpose || undefined,
      });
      toast.success("Follow-up added");
      closeDialog();
      setFollowupForm({ due_date: today(), due_time: "", purpose: "" });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the follow-up");
    } finally {
      setSaving(false);
    }
  };

  const handleTemperature = async (value: LeadTemperature) => {
    setSaving(true);
    try {
      await salesLeadsApi.setTemperature(leadId, value);
      toast.success(`Marked ${value.toUpperCase()}`);
      closeDialog();
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the temperature");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelMeeting = async (m: SalesMeeting) => {
    const ok = await confirm({
      title: "Call off this meeting?",
      description: `"${m.title}" is removed from the diary and the reason is recorded on the lead's timeline. The lead itself is not changed.`,
      confirmLabel: "Call it off",
      destructive: true,
    });
    if (!ok) return;
    try {
      await salesMeetingsApi.cancel(m.id);
      toast.success("Meeting cancelled");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel the meeting");
    }
  };

  const handleRevert = async () => {
    const converted = lead?.status === "converted";
    // The browser's own confirm() puts the raw host name at the top
    // ("project.kynetropo.com says"), cannot be styled, and blocks the main
    // thread — on a phone it reads like a phishing prompt rather than part of
    // the app.
    const ok = await confirm(
      converted
        ? {
            title: "Undo this conversion?",
            description:
              "The lead returns to onboarding.\nThe customer record this conversion created is removed from the CRM, along with the project it opened.\nIf that customer already existed, or has work attached to it now, it is kept and you will be told why.",
            confirmLabel: "Undo conversion",
            destructive: true,
          }
        : {
            title: "Move this lead back out of onboarding?",
            description: "It returns to qualified. Nothing else about the lead changes.",
            confirmLabel: "Move back",
          },
    );
    if (!ok) return;
    setSaving(true);
    try {
      const res = await salesLeadsApi.revert(leadId);
      if (!converted) {
        toast.success("Moved back to qualified");
      } else if (res.removed_client_id) {
        toast.success(
          `Conversion undone — customer #${res.removed_client_id}` +
            (res.removed_project_id ? " and its project" : "") +
            " removed from the CRM",
        );
      } else {
        // Not an error: the record was deliberately kept, and the reason is the
        // only useful thing to say about it.
        toast.warning(
          `Conversion undone — customer #${res.kept_customer_id} was kept` +
            (res.kept_reason ? `: ${res.kept_reason}` : ""),
        );
      }
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revert the lead");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Deletes the lead and everything hanging off it.
   *
   * The confirmation counts the work that goes with it rather than asking "are
   * you sure": a lead with eleven calls and two open follow-ups against it is
   * almost never the one somebody meant to delete, and the count is the only
   * thing on the screen that would stop them.
   */
  const handleDelete = async () => {
    if (!lead) return;
    const attached = [
      lead.calls?.length ? `${lead.calls.length} call${lead.calls.length === 1 ? "" : "s"}` : null,
      lead.followups?.length
        ? `${lead.followups.length} follow-up${lead.followups.length === 1 ? "" : "s"}`
        : null,
      lead.meetings?.length
        ? `${lead.meetings.length} meeting${lead.meetings.length === 1 ? "" : "s"}`
        : null,
    ].filter(Boolean) as string[];

    const ok = await confirm({
      title: `Delete ${lead.company || lead.name}?`,
      description:
        (attached.length
          ? `Its ${attached.join(", ")} and its whole timeline go with it.\n`
          : "Its timeline goes with it.\n") +
        "This cannot be undone. To take a lead out of the pipeline without losing its history, mark it lost instead.",
      confirmLabel: "Delete lead",
      destructive: true,
    });
    if (!ok) return;

    setSaving(true);
    try {
      await salesLeadsApi.remove(leadId);
      toast.success("Lead deleted");
      // Nothing left to show, so leave before the page tries to reload it.
      navigate("/sales/leads");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the lead");
      setSaving(false);
    }
  };

  // Opened from a notification or a link there is no previous screen: back goes to the leads.
  const hasHistory = typeof window !== "undefined" && ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const back = hasHistory ? -1 : "/sales/leads";

  if (phone && (loading || error || !lead)) {
    return (
      <SalesLayout>
        <div className="space-y-3">
          <TopBar back={back} title="Lead" />
          {loading ? <Loading /> : (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
              {error ?? "Lead not found"}
            </div>
          )}
        </div>
      </SalesLayout>
    );
  }

  if (loading) {
    return (
      <SalesLayout>
        <RecordDetailPage>
          <RecordProfileHeader backTo="/sales/leads" backLabel="Leads" crumb="Lead" icon={Users} title="Lead" loading />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </RecordDetailPage>
      </SalesLayout>
    );
  }

  if (error || !lead) {
    return (
      <SalesLayout>
        <RecordDetailPage>
          <RecordProfileHeader backTo="/sales/leads" backLabel="Leads" crumb="Lead" icon={Users} title="Lead" />
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            {error ?? "Lead not found"}
          </div>
        </RecordDetailPage>
      </SalesLayout>
    );
  }

  const pendingFollowups = lead.followups.filter((f) => f.status === "pending");
  const scheduledMeetings = lead.meetings.filter((m) => m.status === "scheduled");

  const initials = (lead.company || lead.name).split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? "").join("");
  const eyebrow = [lead.lead_code, lead.source ? sourceLabel(lead.source, lead.source_chapter) : null, `added ${formatDate(lead.acquired_on ?? lead.created_at)}`].filter(Boolean).join(" · ");
  const factsData: Array<ProfileFact | null> = [
    lead.phone ? { icon: Phone, label: "Phone", value: lead.phone, href: `tel:${lead.phone}` } : null,
    lead.email ? { icon: Mail, label: "Email", value: lead.email, href: `mailto:${lead.email}` } : null,
    lead.company ? { icon: Building2, label: "Company", value: lead.company } : null,
    lead.contact_person ? { icon: UserCheck, label: "Contact", value: lead.contact_person } : null,
    { icon: Megaphone, label: "Source", value: lead.source ? sourceLabel(lead.source, lead.source_chapter) : "Not recorded" },
  ];
  const facts = factsData.filter((f): f is ProfileFact => f !== null);

  const timelineItems: TimelineItem[] = lead.timeline.map((a) => ({
    label: a.title,
    at: a.occurred_at,
    by: a.actor_name || undefined,
    description: a.description || undefined,
    tone: (a.activity_type === "lead_converted" ? "done" : a.activity_type === "call_logged" ? "active" : "done") as TimelineItem["tone"],
  }));

  const startOnboarding = async () => {
    setSaving(true);
    try {
      await salesLeadsApi.startOnboarding(leadId);
      toast.success("Moved to onboarding");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the lead");
    } finally {
      setSaving(false);
    }
  };

  const dialogs = (
    <>
      {/* ── Log Call ─────────────────────────────────────────────────────── */}
      <LogCallDialog
        open={dialog === "call"}
        lead={lead}
        onClose={closeDialog}
        onLogged={() => void load()}
      />

      <MeetingFormDialog
        open={dialog === "meeting"}
        leadId={leadId}
        leadLabel={lead.company || lead.name}
        meeting={editingMeeting}
        onClose={closeDialog}
        onSaved={() => void load()}
      />

      {/* ── Add Follow-Up ────────────────────────────────────────────────── */}
      <Dialog open={dialog === "followup"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Follow-Up</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddFollowup} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-date">Date</Label>
                <Input
                  id="f-date"
                  type="date"
                  value={followupForm.due_date}
                  onChange={(e) => setFollowupForm((f) => ({ ...f, due_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-time">Time</Label>
                <Input
                  id="f-time"
                  type="time"
                  value={followupForm.due_time}
                  onChange={(e) => setFollowupForm((f) => ({ ...f, due_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-purpose">Purpose</Label>
              <Input
                id="f-purpose"
                value={followupForm.purpose}
                placeholder="Send proposal, confirm requirement…"
                onChange={(e) => setFollowupForm((f) => ({ ...f, purpose: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Add"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Change Temperature ───────────────────────────────────────────── */}
      <Dialog open={dialog === "temperature"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Lead Temperature</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {(["hot", "warm", "cold"] as const).map((t) => (
              <Button
                key={t}
                variant={lead.temperature === t ? "default" : "outline"}
                className="h-12 justify-start capitalize"
                disabled={saving}
                onClick={() => void handleTemperature(t)}
              >
                <Thermometer className="mr-2 h-4 w-4" />
                {t}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <MeetingOutcomeDialog
        open={dialog === "meeting_outcome"}
        meeting={outcomeMeeting}
        onClose={closeDialog}
        onSaved={() => void load()}
      />


      <FollowupEditDialog
        followup={editingFollowup}
        onClose={() => setEditingFollowup(null)}
        onSaved={() => void load()}
      />

      <FollowupCompleteDialog
        followup={completingFollowup}
        onClose={() => setCompletingFollowup(null)}
        // The outcome can move the lead's status and temperature, so the whole
        // record is reloaded rather than the one row patched.
        onCompleted={() => void load()}
      />


      <CommentThreadDialog
        open={thread !== null}
        onOpenChange={(o) => {
          if (!o) {
            setThread(null);
            // Refresh once on close, so the row badges pick up the new count.
            void load();
          }
        }}
        title={thread?.title ?? "Comments"}
        entityType={thread?.type ?? "lead"}
        entityId={thread?.id ?? 0}
      />

      <FollowupCloseDialog
        followup={closingFollowup}
        onClose={() => setClosingFollowup(null)}
        onClosed={() => void load()}
      />
    </>
  );

  /*
   * The phone app: a screen of its own rather than the computer's page squeezed
   * down — the coloured bar with a back arrow, the lead as a contact card with
   * round buttons to call, WhatsApp or e-mail, what is still to do as rows with
   * their buttons at the end, and Log Call / Follow-Up held at the bottom.
   */
  if (phone) {
    const digits = (lead.phone ?? "").replace(/\D/g, "");
    const whatsapp = digits ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : null;
    const contact = lead.contact_person || lead.name;
    const details = [
      { label: "Contact", value: contact },
      { label: "Phone", value: lead.phone ? <a href={`tel:${lead.phone}`} className="text-primary">{lead.phone}</a> : null },
      { label: "Email", value: lead.email ? <a href={`mailto:${lead.email}`} className="break-all text-primary">{lead.email}</a> : null },
      { label: "Source", value: lead.source ? sourceLabel(lead.source, lead.source_chapter) : null },
      { label: "Came in", value: formatDate(lead.acquired_on ?? lead.created_at) },
      { label: "Owner", value: lead.assigned_to_name || "Unassigned" },
      { label: "Using now", value: lead.current_software },
      { label: "Why they came", value: lead.switch_reason },
      { label: "Notes", value: lead.notes },
    ].filter((d) => d.value);
    const activity = allActivity ? lead.timeline : lead.timeline.slice(0, 6);
    const todayIso = today();
    const canConvert = can("sales.leads.convert");

    return (
      <SalesLayout>
        <div className="space-y-4">
          <TopBar back={back} title={lead.company || lead.name}
            sub={[lead.lead_code, statusLabel(lead.status)].filter(Boolean).join(" · ")}
            right={can("sales.leads.edit") ? <BarButton icon={Pencil} label="Edit lead" to={`/sales/leads/${leadId}/edit`} /> : undefined} />

          {/* The lead, as a contact card. */}
          <section className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-3">
              <Avatar name={lead.company || lead.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold leading-tight">{lead.company || lead.name}</p>
                {lead.company && contact ? <p className="truncate text-sm text-muted-foreground">{contact}</p> : null}
                <p className="mt-0.5 flex items-center gap-1 text-sm text-primary">
                  <Megaphone className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.source ? sourceLabel(lead.source, lead.source_chapter) : "Source not recorded"}</span>
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Pill tone={STATUS_TONE[lead.status] ?? "muted"}>{statusLabel(lead.status)}</Pill>
                  {can("sales.leads.edit")
                    ? <button type="button" aria-label="Change temperature" onClick={() => setDialog("temperature")}><TempPill value={lead.temperature} /></button>
                    : <TempPill value={lead.temperature} />}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-1">
              {lead.phone && <QuickAction icon={Phone} label="Call" href={`tel:${lead.phone}`} />}
              {whatsapp && <QuickAction icon={MessageCircle} label="WhatsApp" href={whatsapp} />}
              {lead.email && <QuickAction icon={Mail} label="Email" href={`mailto:${lead.email}`} />}
              {can("sales.meetings.create") && (
                <QuickAction icon={CalendarPlus} label="Meeting" onClick={() => { setEditingMeeting(null); setDialog("meeting"); }} />
              )}
            </div>
          </section>

          {/* The work so far, in three figures. */}
          <section className="grid grid-cols-3 divide-x rounded-2xl border bg-card py-3 text-center">
            <div><p className="text-xl font-semibold tabular-nums">{lead.calls?.length ?? 0}</p><p className="text-xs text-muted-foreground">Calls</p></div>
            <div><p className="text-xl font-semibold tabular-nums">{pendingFollowups.length}</p><p className="text-xs text-muted-foreground">Open follow-ups</p></div>
            <div><p className="text-xl font-semibold tabular-nums">{lead.meetings.length}</p><p className="text-xs text-muted-foreground">Meetings</p></div>
          </section>

          {/* A customer now: the client line (First Meetup … Closed). Before that, the lead's own steps. */}
          {lead.status === "converted" && lead.client_stage ? (
            <PhonePipeline steps={CLIENT_STAGES} current={lead.client_stage} notes={{ "Quotation Sent": quotationSummary(lead.quotations) }} />
          ) : lead.status !== "lost" ? (
            <PhonePipeline steps={LEAD_STEPS.map((s) => s.label)} current={statusLabel(lead.status)} notes={{ Quotation: quotationSummary(lead.quotations) }} />
          ) : null}

          {lead.status !== "lost" || (lead.quotations?.length ?? 0) > 0 ? (
            <PhoneQuotation leadId={lead.id} rounds={lead.quotations} canEdit={can("sales.leads.edit") && lead.status !== "lost"} onChanged={() => void load()} />
          ) : null}

          {lead.status === "converted" && (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Customer since {formatDate(lead.converted_at)}</p>
              {lead.converted_client_id && (
                <Link to={`/clients/${lead.converted_client_id}`} className="mt-1 inline-block text-xs font-medium text-emerald-800 underline dark:text-emerald-300">
                  Open the customer record
                </Link>
              )}
            </section>
          )}

          {/* Still to do: each with its buttons at the end of the row. */}
          {(pendingFollowups.length > 0 || scheduledMeetings.length > 0) && (
            <List title="To do">
              {pendingFollowups.map((f) => (
                <div key={`f${f.id}`} className="flex items-center">
                  <div className="min-w-0 flex-1">
                    <Row avatar={<Avatar icon={CalendarClock} tone="violet" />}
                      onClick={can("sales.followups.create") && canEditFollowup(f, me ?? null) ? () => setEditingFollowup(f) : undefined}
                      title="Follow-up"
                      meta={<span className={cn(f.due_date < todayIso && "font-medium text-destructive")}>{dueAt(f)}</span>}
                      sub={f.purpose || "No purpose written"} />
                  </div>
                  {can("sales.followups.complete") && (
                    <div className="mr-3 flex gap-2">
                      <RowButton icon={XCircle} label="Close — no longer needed" tone="muted" onClick={() => setClosingFollowup(f)} />
                      <RowButton icon={CheckCircle2} label="Done — how did it go?" tone="success" onClick={() => setCompletingFollowup(f)} />
                    </div>
                  )}
                </div>
              ))}
              {scheduledMeetings.map((m) => (
                <div key={`m${m.id}`} className="flex items-center">
                  <div className="min-w-0 flex-1">
                    <Row avatar={<Avatar icon={CalendarPlus} tone="sky" />}
                      onClick={can("sales.meetings.edit") ? () => { setOutcomeMeeting(m); setDialog("meeting_outcome"); } : undefined}
                      title={m.title}
                      meta={shortDate(m.meeting_time ? `${m.meeting_date} ${m.meeting_time}` : m.meeting_date)}
                      sub={[humanise(m.meeting_type), m.place].filter(Boolean).join(" · ")} />
                  </div>
                  <div className="mr-3 flex gap-2">
                    {m.meeting_link && <RowButton icon={ExternalLink} label="Join" href={m.meeting_link} />}
                    {can("sales.meetings.edit") && (
                      <>
                        <RowButton icon={Pencil} label="Move it, or fix the link" tone="muted" onClick={() => { setEditingMeeting(m); setDialog("meeting"); }} />
                        <RowButton icon={CalendarX} label="Call it off" tone="muted" onClick={() => void handleCancelMeeting(m)} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </List>
          )}

          <Block title="Details">
            <dl className="divide-y">
              {details.map((d) => (
                <div key={d.label} className="flex gap-3 px-4 py-3 text-sm">
                  <dt className="w-28 shrink-0 text-muted-foreground">{d.label}</dt>
                  <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words">{d.value}</dd>
                </div>
              ))}
            </dl>
          </Block>

          {/* What else can be done with the lead. */}
          <List title="Lead">
            {can("sales.leads.edit") && (
              <Row to={`/sales/leads/${leadId}/edit`} avatar={<Avatar icon={Pencil} tone="primary" />} title="Edit lead" end={<ChevronRight className="h-5 w-5 text-muted-foreground" />} sub="Name, phone, source, notes" />
            )}
            {can("sales.leads.edit") && (
              <Row onClick={() => setDialog("temperature")} avatar={<Avatar icon={Thermometer} tone="warning" />} title="Temperature" sub={`Now ${humanise(lead.temperature)}`} end={<ChevronRight className="h-5 w-5 text-muted-foreground" />} />
            )}
            {canConvert && lead.status !== "converted" && lead.status !== "onboarding" && (
              <Row onClick={() => void startOnboarding()} avatar={<Avatar icon={UserCheck} tone="violet" />} title="Move to onboarding" sub="They said yes; setting them up" end={<ChevronRight className="h-5 w-5 text-muted-foreground" />} />
            )}
            {canConvert && lead.status !== "converted" && (
              <Row to={`/sales/leads/${leadId}/convert`} avatar={<Avatar icon={CheckCircle2} tone="success" />} title="Convert to customer" sub="Customer, project and AMC" end={<ChevronRight className="h-5 w-5 text-muted-foreground" />} />
            )}
            {canConvert && (lead.status === "converted" || lead.status === "onboarding") && (
              <Row onClick={() => void handleRevert()} avatar={<Avatar icon={Undo2} tone="muted" />} title={lead.status === "converted" ? "Undo conversion" : "Undo onboarding"} end={<ChevronRight className="h-5 w-5 text-muted-foreground" />} />
            )}
          </List>

          <Block title="Activity">
            {lead.timeline.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ol className="px-4 pb-2 pt-2">
                {activity.map((a) => (
                  <li key={a.id} className="relative ml-1.5 border-l pb-4 pl-4 last:border-transparent">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <p className="text-sm font-medium leading-snug">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{[shortDate(a.occurred_at), a.actor_name].filter(Boolean).join(" · ")}</p>
                    {a.description && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{a.description}</p>}
                  </li>
                ))}
              </ol>
            )}
            {lead.timeline.length > activity.length && (
              <button type="button" onClick={() => setAllActivity(true)} className="w-full border-t py-3 text-sm font-medium text-primary">
                Show all {lead.timeline.length}
              </button>
            )}
          </Block>

          {can("sales.comments.view") && (
            <Block title="Discussion">
              <div className="p-4 pt-2">
                <CommentThread entityType="lead" entityId={lead.id} initialComments={lead.comments ?? []} />
              </div>
            </Block>
          )}

          {can("sales.leads.assign") && lead.status !== "converted" && (
            <button type="button" disabled={saving} onClick={handleDelete}
              className="flex w-full items-center justify-center gap-1.5 py-3 text-sm font-medium text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete lead
            </button>
          )}

          {(can("sales.calls.create") || can("sales.followups.create")) && (
            <ActionBar>
              <div className="grid grid-cols-2 gap-2">
                {can("sales.calls.create") && (
                  <Button className="h-12 text-base" onClick={() => setDialog("call")}><Phone className="mr-1.5 h-5 w-5" />Log Call</Button>
                )}
                {can("sales.followups.create") && (
                  <Button className="h-12 text-base" variant="secondary" onClick={() => setDialog("followup")}><CalendarClock className="mr-1.5 h-5 w-5" />Follow-Up</Button>
                )}
              </div>
            </ActionBar>
          )}

          {dialogs}
        </div>
      </SalesLayout>
    );
  }

  return (
    <SalesLayout>
      <RecordDetailPage>
      <RecordProfileHeader
        backTo="/sales/leads"
        backLabel="Leads"
        crumb={lead.company || lead.name}
        icon={Users}
        mark={initials}
        eyebrow={eyebrow}
        status={<span className="flex gap-2"><LeadStatusBadge value={lead.status} /><TemperatureBadge value={lead.temperature} /></span>}
        title={lead.company || lead.name}
        subtitle={lead.assigned_to_name ? <span className="inline-flex items-center gap-1.5"><UserCheck className="h-4 w-4 shrink-0" />{lead.assigned_to_name}</span> : undefined}
        facts={facts}
      />

      <DetailStats>
        <StatCard title="Calls" value={String(lead.calls?.length ?? 0)} icon={Phone} accent="sky" />
        <StatCard title="Follow-ups" value={String(lead.followups.length)} subtitle={`${pendingFollowups.length} open`} icon={CalendarClock} accent="violet" subtitleColor={pendingFollowups.length > 0 ? "primary" : "muted"} />
        <StatCard title="Meetings" value={String(lead.meetings.length)} subtitle={`${scheduledMeetings.length} scheduled`} icon={CalendarPlus} accent="teal" />
      </DetailStats>

      {(lead.current_software || lead.switch_reason) && (
        <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          {lead.current_software && (
            <div className="flex items-start gap-2.5">
              <MonitorCog className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Using now</p>
                <p className="break-words text-sm text-card-foreground">{lead.current_software}</p>
              </div>
            </div>
          )}
          {lead.switch_reason && (
            <div className="flex items-start gap-2.5">
              <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Why they came to us</p>
                <p className="whitespace-pre-wrap break-words text-sm text-card-foreground">{lead.switch_reason}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {(lead.next_followup_at || lead.next_meeting_at) && (
        <div className="grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-2">
          {lead.next_followup_at && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next follow-up</p>
              <p className="text-sm font-medium">{formatDateTime(lead.next_followup_at)}</p>
            </div>
          )}
          {lead.next_meeting_at && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next meeting</p>
              <p className="text-sm font-medium">{formatDateTime(lead.next_meeting_at)}</p>
            </div>
          )}
        </div>
      )}

      {lead.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{lead.notes}</p>}

      {lead.status === "converted" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-800">Converted to Customer</p>
          <p className="text-emerald-700">Conversion date: {formatDate(lead.converted_at)}</p>
          {lead.converted_client_id && (
            <Link
              to={`/clients/${lead.converted_client_id}`}
              className="mt-1 inline-block text-xs font-medium text-emerald-800 underline"
            >
              Open customer record #{lead.converted_client_id} in the project system
            </Link>
          )}
          {can("sales.leads.convert") && (
            <p className="mt-2 text-xs text-emerald-700">
              Converted by mistake? "Undo Convert" returns the lead to onboarding and removes the
              customer record it created — unless that customer already existed or has work
              attached to it by now.
            </p>
          )}
        </div>
      )}

      <section className="sticky bottom-16 z-30 -mx-1 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur md:static md:bottom-auto md:mx-0 md:shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {can("sales.calls.create") && (
            <Button className="h-11" onClick={() => setDialog("call")}>
              <Phone className="mr-1.5 h-4 w-4" />
              Log Call
            </Button>
          )}
          {can("sales.meetings.create") && (
            <Button
              className="h-11"
              variant="secondary"
              onClick={() => {
                setEditingMeeting(null);
                setDialog("meeting");
              }}
            >
              <CalendarPlus className="mr-1.5 h-4 w-4" />
              Meeting
            </Button>
          )}
          {can("sales.followups.create") && (
            <Button className="h-11" variant="secondary" onClick={() => setDialog("followup")}>
              <CalendarClock className="mr-1.5 h-4 w-4" />
              Follow-Up
            </Button>
          )}
          {can("sales.leads.edit") && (
            <Button className="h-11" variant="outline" onClick={() => navigate(`/sales/leads/${leadId}/edit`)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit Lead
            </Button>
          )}
          {can("sales.leads.edit") && (
            <Button className="h-11" variant="outline" onClick={() => setDialog("temperature")}>
              <Thermometer className="mr-1.5 h-4 w-4" />
              Temperature
            </Button>
          )}
          {can("sales.leads.convert") && (lead.status === "converted" || lead.status === "onboarding") && (
            <Button className="h-11" variant="outline" disabled={saving} onClick={handleRevert}>
              <Undo2 className="mr-1.5 h-4 w-4" />
              {lead.status === "converted" ? "Undo Convert" : "Undo Onboarding"}
            </Button>
          )}
          {can("sales.leads.convert") && lead.status !== "converted" && (
            <>
              {lead.status !== "onboarding" && (
                <Button
                  className="h-11"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void startOnboarding()}
                >
                  Onboarding
                </Button>
              )}
              <Button className="h-11" variant="outline" disabled={saving} onClick={() => navigate(`/sales/leads/${leadId}/convert`)}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Convert
              </Button>
            </>
          )}
        </div>
      </section>

      <QuotationCard leadId={lead.id} rounds={lead.quotations} canEdit={can("sales.leads.edit")} onChanged={() => void load()} />

      {/* Open work */}
      {(pendingFollowups.length > 0 || scheduledMeetings.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Open</h2>
          {pendingFollowups.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Follow-up {formatDate(f.due_date)}
                  {f.due_time ? ` · ${formatTime(f.due_time)}` : ""}
                </p>
                {f.purpose && <p className="truncate text-xs text-muted-foreground">{f.purpose}</p>}
                <FollowupEditNote followup={f} className="mt-1" />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {can("sales.comments.view") && (
                  <CommentButton
                    count={lead.comment_counts?.followup?.[f.id] ?? 0}
                    onClick={() => setThread({ type: "followup", id: f.id, title: `Follow-up ${formatDate(f.due_date)}` })}
                  />
                )}
                {can("sales.followups.create") && canEditFollowup(f, me ?? null) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 text-muted-foreground"
                    aria-label="Edit follow-up"
                    onClick={() => setEditingFollowup(f)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {can("sales.followups.complete") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 text-muted-foreground hover:text-destructive"
                    aria-label="Close follow-up"
                    title="Close — no longer needed"
                    onClick={() => setClosingFollowup(f)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
                {can("sales.followups.complete") && (
                  <Button size="sm" variant="outline" className="h-9" onClick={() => setCompletingFollowup(f)}>
                    Done
                  </Button>
                )}
              </div>
            </div>
          ))}
          {scheduledMeetings.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {humanise(m.meeting_type)} · {formatDate(m.meeting_date)}
                  {m.meeting_time ? ` · ${formatTime(m.meeting_time)}` : ""}
                  {m.place ? ` · ${m.place}` : ""}
                </p>
                {m.meeting_link && <MeetingLink href={m.meeting_link} label="Join link" className="text-xs" />}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {can("sales.comments.view") && (
                  <CommentButton
                    count={lead.comment_counts?.meeting?.[m.id] ?? 0}
                    onClick={() => setThread({ type: "meeting", id: m.id, title: m.title })}
                  />
                )}
                {can("sales.meetings.edit") && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        setOutcomeMeeting(m);
                        setDialog("meeting_outcome");
                      }}
                    >
                      Outcome
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2"
                      aria-label="Edit meeting"
                      title="Move it, or fix the link"
                      onClick={() => {
                        setEditingMeeting(m);
                        setDialog("meeting");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2 text-destructive hover:text-destructive"
                      aria-label="Cancel meeting"
                      title="Call it off"
                      onClick={() => void handleCancelMeeting(m)}
                    >
                      <CalendarX className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Activity timeline */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Activity Timeline</h2>
        <DetailTimeline items={timelineItems} empty="No activity recorded yet." />
      </section>

      {/* Team discussion — anyone who can see the lead can talk about it here. */}
      {can("sales.comments.view") && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Discussion</h2>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <CommentThread entityType="lead" entityId={lead.id} initialComments={lead.comments ?? []} />
          </div>
        </section>
      )}

      {/*
        Deleting sits at the foot of the page rather than in the sticky action
        bar. That bar is under the thumb on every screen of this record, and an
        irreversible action does not belong somewhere it can be caught on the
        way past — reaching this one takes a deliberate scroll to the bottom.
        Same permission the server enforces, so it is never offered to somebody
        who would be refused.
      */}
      {can("sales.leads.assign") && (
        <section className="rounded-2xl border border-destructive/25 bg-destructive/[0.03] p-4">
          {lead.status === "converted" ? (
            <p className="text-xs text-muted-foreground">
              A converted lead cannot be deleted — the customer record it created still points at
              its sales history. Undo the conversion first if it was made by mistake.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Deleting removes this lead and every call, follow-up and meeting on it.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={saving}
                onClick={handleDelete}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete Lead
              </Button>
            </div>
          )}
        </section>
      )}

      {dialogs}
      </RecordDetailPage>
    </SalesLayout>
  );
}
