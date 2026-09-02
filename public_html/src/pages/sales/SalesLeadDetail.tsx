import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Building2, CalendarClock, CalendarPlus, CalendarX, CheckCircle2,
  Mail, MessageSquareQuote, MonitorCog, Pencil, Phone, Thermometer, Undo2, UserCheck,
} from "lucide-react";
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
import { LogCallDialog } from "@/components/sales/LogCallDialog";
import { MeetingFormDialog, MeetingOutcomeDialog } from "@/components/sales/MeetingDialogs";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  FollowupEditDialog,
  FollowupEditNote,
  canEditFollowup,
} from "@/components/sales/FollowupEditDialog";
import { CommentButton, CommentThread, CommentThreadDialog } from "@/components/sales/CommentThread";
import { ConvertLeadDialog } from "@/components/sales/ConvertLeadDialog";
import { LeadFormDialog } from "@/components/sales/LeadFormDialog";
import {
  LeadStatusBadge, MeetingLink, TemperatureBadge,
  formatDate, formatDateTime, formatTime, humanise,
} from "@/components/sales/SalesBits";
import type {
  CommentEntityType, LeadTemperature, SalesFollowup, SalesMeeting,
  SalesLeadDetail as LeadDetail,
} from "@/types/sales";
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
  const confirm = useConfirm();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [editingFollowup, setEditingFollowup] = useState<SalesFollowup | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [thread, setThread] = useState<{ type: CommentEntityType; id: number; title: string } | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
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

  const handleCompleteFollowup = async (followupId: number) => {
    try {
      await salesFollowupsApi.complete(followupId);
      toast.success("Follow-up completed");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete the follow-up");
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

  if (loading) {
    return (
      <SalesLayout>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </SalesLayout>
    );
  }

  if (error || !lead) {
    return (
      <SalesLayout>
        <Button variant="ghost" size="sm" onClick={() => navigate("/sales/leads")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to leads
        </Button>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error ?? "Lead not found"}
        </div>
      </SalesLayout>
    );
  }

  const pendingFollowups = lead.followups.filter((f) => f.status === "pending");
  const scheduledMeetings = lead.meetings.filter((m) => m.status === "scheduled");

  return (
    <SalesLayout>
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => navigate("/sales/leads")}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Leads
      </Button>

      {/* Lead information */}
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-card-foreground">{lead.company || lead.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{lead.contact_person || lead.name}</p>
          </div>
          <TemperatureBadge value={lead.temperature} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LeadStatusBadge value={lead.status} />
          <span className="text-[11px] text-muted-foreground">{lead.lead_code}</span>
          {lead.source && <span className="text-[11px] text-muted-foreground">· {humanise(lead.source)}</span>}
          {/*
            How long we have actually had them. Falls back to the day the
            record was made, which is what a lead with no stated date means.
          */}
          <span className="text-[11px] text-muted-foreground">
            · Client since {formatDate(lead.acquired_on ?? lead.created_at)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field icon={Phone} label="Phone" value={lead.phone} />
          <Field icon={Mail} label="Email" value={lead.email} />
          <Field icon={Building2} label="Company" value={lead.company} />
          <Field icon={UserCheck} label="Assigned to" value={lead.assigned_to_name} />
        </div>

        {/* Only when there is something to say — an empty pair of headings on
            every older lead would be worse than not asking. */}
        {(lead.current_software || lead.switch_reason) && (
          <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
            {lead.current_software && (
              <div className="flex items-start gap-2.5">
                <MonitorCog className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Using now
                  </p>
                  <p className="break-words text-sm text-card-foreground">{lead.current_software}</p>
                </div>
              </div>
            )}
            {lead.switch_reason && (
              <div className="flex items-start gap-2.5">
                <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Why they came to us
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm text-card-foreground">
                    {lead.switch_reason}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {(lead.next_followup_at || lead.next_meeting_at) && (
          <div className="mt-4 grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-2">
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

        {lead.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{lead.notes}</p>}

        {lead.status === "converted" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
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
      </section>

      {/* Primary actions — sticky on mobile so they are always one thumb away. */}
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
            <Button className="h-11" variant="outline" onClick={() => setEditOpen(true)}>
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
                  onClick={async () => {
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
                  }}
                >
                  Onboarding
                </Button>
              )}
              <Button className="h-11" variant="outline" disabled={saving} onClick={() => setConvertOpen(true)}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Convert
              </Button>
            </>
          )}
        </div>
      </section>

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
                  <Button size="sm" variant="outline" className="h-9" onClick={() => void handleCompleteFollowup(f.id)}>
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
        {lead.timeline.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
            No activity recorded yet.
          </div>
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {lead.timeline.map((a) => (
              <li key={a.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background",
                    a.activity_type === "lead_converted"
                      ? "bg-emerald-500"
                      : a.activity_type === "call_logged"
                        ? "bg-primary"
                        : "bg-muted-foreground/50",
                  )}
                />
                <p className="text-sm font-medium text-card-foreground">{a.title}</p>
                {a.description && (
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{a.description}</p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDateTime(a.occurred_at)}
                  {a.actor_name ? ` · ${a.actor_name}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
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

      <LeadFormDialog
        open={editOpen}
        lead={lead}
        onClose={() => setEditOpen(false)}
        // A full reload rather than a local patch: the header, the timeline and
        // the schedule all read from this record, and the edit adds a timeline
        // entry the page should show straight away.
        onSaved={() => void load()}
      />

      <FollowupEditDialog
        followup={editingFollowup}
        onClose={() => setEditingFollowup(null)}
        onSaved={() => void load()}
      />

      <ConvertLeadDialog
        lead={lead}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={() => void load()}
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
    </SalesLayout>
  );
}
