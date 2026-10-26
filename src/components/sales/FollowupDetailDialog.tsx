import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, ChevronRight, MessageCircle, Pencil, Phone, User, Users, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { CommentThread } from "@/components/sales/CommentThread";
import { FollowupEditNote } from "@/components/sales/FollowupEditDialog";
import { FollowupCompleteForm, OutcomeBadge } from "@/components/sales/FollowupCompleteDialog";
import { Avatar, Block, List, Pill, Row, usePhoneApp, type Tone } from "@/components/phone/PhoneKit";
import { cn } from "@/lib/utils";
import {
  TemperatureBadge,
  formatDate,
  formatDateTime,
  formatTime,
  humanise,
  subjectLabel,
  subjectPath,
} from "@/components/sales/SalesBits";
import type { SalesFollowup } from "@/types/sales";

/**
 * One follow-up, opened from the queue.
 *
 * The card can only carry what fits on it — the purpose gets one line, the
 * outcome notes are squeezed onto the end of a "Completed" row, and the
 * discussion is a number. Everything the follow-up actually holds is here.
 */
export function FollowupDetailDialog({
  followup,
  onClose,
  onEdit,
  onCloseFollowup,
  onCompleted,
}: {
  followup: SalesFollowup | null;
  onClose: () => void;
  /** Offers "Edit date, time or purpose" here — the phone app's rows have no room for it. */
  onEdit?: (f: SalesFollowup) => void;
  /** Offers "Close follow-up" for one still open. */
  onCloseFollowup?: (f: SalesFollowup) => void;
  /** Completed from the phone app's page, where the form sits in the page itself. */
  onCompleted?: () => void;
}) {
  const { can } = useSalesAccess();
  const phone = usePhoneApp();
  const f = followup;

  return (
    <Dialog open={f !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {f && (
          <>
            <DialogHeader>
              <DialogTitle className="text-left">
                <span className="block truncate">{subjectLabel(f)}</span>
                <span className="block text-sm font-normal text-muted-foreground">
                  {f.status === "completed" ? "Completed follow-up" : f.status === "cancelled" ? "Closed follow-up" : "Follow-up"}
                </span>
              </DialogTitle>
            </DialogHeader>

            {phone ? <PhoneFollowup f={f} onClose={onClose} onEdit={onEdit} onCloseFollowup={onCloseFollowup} onCompleted={onCompleted} /> : (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-card-foreground">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  {formatDate(f.due_date)}
                  {f.due_time ? ` · ${formatTime(f.due_time)}` : ""}
                </span>
                {f.lead_temperature && <TemperatureBadge value={f.lead_temperature} />}
              </div>
              {f.status === "pending" && (onEdit || onCloseFollowup) && (
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {onEdit && (
                    <button type="button" className="text-sm font-medium text-primary underline" onClick={() => onEdit(f)}>
                      Edit date, time or purpose
                    </button>
                  )}
                  {onCloseFollowup && (
                    <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-destructive underline" onClick={() => onCloseFollowup(f)}>
                      <XCircle className="h-4 w-4" />
                      Close follow-up
                    </button>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-card-foreground">What it is for</h3>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {f.purpose || "No purpose was written down."}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Owner</dt>
                  <dd className="flex items-center gap-1.5 text-card-foreground">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {f.assigned_to_name || "Unassigned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</dt>
                  <dd className="font-medium text-card-foreground">{humanise(f.status)}</dd>
                </div>
                {f.lead_contact_person && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Contact</dt>
                    <dd className="truncate text-card-foreground">{f.lead_contact_person}</dd>
                  </div>
                )}
                {f.lead_phone && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Phone</dt>
                    <dd>
                      {/* Tapping it should dial — this is a phone. */}
                      <a href={`tel:${f.lead_phone}`} className="inline-flex items-center gap-1.5 text-primary underline">
                        <Phone className="h-3.5 w-3.5" />
                        {f.lead_phone}
                      </a>
                    </dd>
                  </div>
                )}
                {f.lead_last_outcome && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Last outcome</dt>
                    <dd className="text-card-foreground">{humanise(f.lead_last_outcome)}</dd>
                  </div>
                )}
                {f.call_id && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Came from</dt>
                    <dd className="text-card-foreground">A logged call</dd>
                  </div>
                )}
                {f.meeting_id && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Came from</dt>
                    <dd className="text-card-foreground">A meeting</dd>
                  </div>
                )}
              </dl>

              {/* Why it moved, and who moved it — the part that tells a
                  rescheduled follow-up from a missed one. */}
              <FollowupEditNote followup={f} />

              {f.status === "completed" && (
                <div className="rounded-xl bg-muted/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Completed {formatDateTime(f.completed_at)}
                    </p>
                    {/* How it went, in its own words. Anything completed before
                        the question was asked simply has no badge. */}
                    <OutcomeBadge value={f.outcome} />
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {f.outcome_notes || "No outcome notes were written."}
                  </p>
                </div>
              )}

              {f.status === "cancelled" && (
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <XCircle className="h-4 w-4" />
                    Closed {formatDateTime(f.completed_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {f.outcome_notes || "No reason was written."}
                  </p>
                </div>
              )}

              <Link
                to={subjectPath(f)}
                className="inline-block text-sm text-primary underline"
                onClick={onClose}
              >
                Open the lead
              </Link>

              {can("sales.comments.view") && (
                <div className="border-t pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-card-foreground">Discussion</h3>
                  <CommentThread entityType="followup" entityId={f.id} />
                </div>
              )}
            </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const TEMP_TONE: Record<string, Tone> = { hot: "danger", warm: "warning", cold: "sky" };

/** Today by the phone's clock, as YYYY-MM-DD. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The follow-up as a phone screen: when and what for at the top with buttons to
 * call or WhatsApp, how it went and the next follow-up in the page itself, then
 * the details, the other actions as rows, and the discussion.
 */
function PhoneFollowup({ f, onClose, onEdit, onCloseFollowup, onCompleted }: {
  f: SalesFollowup;
  onClose: () => void;
  onEdit?: (f: SalesFollowup) => void;
  onCloseFollowup?: (f: SalesFollowup) => void;
  onCompleted?: () => void;
}) {
  const { can } = useSalesAccess();
  const pending = f.status === "pending";
  const today = todayIso();
  const when = !pending ? (f.status === "completed" ? "Completed" : "Closed")
    : f.due_date < today ? "Overdue" : f.due_date === today ? "Today" : "Upcoming";
  const digits = (f.lead_phone ?? "").replace(/\D/g, "");
  const whatsapp = digits ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : null;
  const details = [
    { label: "Owner", value: f.assigned_to_name || "Unassigned" },
    { label: "Contact", value: f.lead_contact_person },
    { label: "Phone", value: f.lead_phone ? <a href={`tel:${f.lead_phone}`} className="text-primary">{f.lead_phone}</a> : null },
    { label: "Last outcome", value: f.lead_last_outcome ? humanise(f.lead_last_outcome) : null },
    { label: "Came from", value: f.call_id ? "A logged call" : f.meeting_id ? "A meeting" : null },
  ].filter((d) => d.value);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <Avatar icon={CalendarClock} tone={when === "Overdue" ? "danger" : pending ? "violet" : "muted"} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-tight">
              {formatDate(f.due_date)}{f.due_time ? ` · ${formatTime(f.due_time)}` : ""}
            </p>
            <p className={cn("text-sm", when === "Overdue" ? "font-medium text-destructive" : "text-muted-foreground")}>{when}</p>
          </div>
          {f.lead_temperature ? <Pill tone={TEMP_TONE[f.lead_temperature] ?? "muted"}>{humanise(f.lead_temperature)}</Pill> : null}
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-base">{f.purpose || <span className="text-muted-foreground">No purpose written</span>}</p>
        <FollowupEditNote followup={f} className="mt-2" />
        {(f.lead_phone || whatsapp) && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {f.lead_phone && (
              <a href={`tel:${f.lead_phone}`} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary/10 font-medium text-primary active:bg-primary/20">
                <Phone className="h-4 w-4" />Call
              </a>
            )}
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500/10 font-medium text-emerald-700 active:bg-emerald-500/20 dark:text-emerald-300">
                <MessageCircle className="h-4 w-4" />WhatsApp
              </a>
            )}
          </div>
        )}
      </section>

      {/* How it went, and the next follow-up — right here rather than on another screen. */}
      {pending && can("sales.followups.complete") && (
        <Block title="How did it go?" icon={CheckCircle2}>
          <div className="p-4 pt-2 [&>form>div:first-child>label]:hidden">
            <FollowupCompleteForm followup={f} large onCompleted={() => { onCompleted?.(); onClose(); }} />
          </div>
        </Block>
      )}

      {f.status === "completed" && (
        <section className="rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />Completed {formatDateTime(f.completed_at)}</p>
            <OutcomeBadge value={f.outcome} />
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{f.outcome_notes || "No outcome notes were written."}</p>
        </section>
      )}
      {f.status === "cancelled" && (
        <section className="rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-1.5 font-medium text-muted-foreground"><XCircle className="h-4 w-4" />Closed {formatDateTime(f.completed_at)}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{f.outcome_notes || "No reason was written."}</p>
        </section>
      )}

      {details.length > 0 && (
        <Block title="Details">
          <dl className="divide-y">
            {details.map((d) => (
              <div key={d.label} className="flex gap-3 px-4 py-3 text-sm">
                <dt className="w-28 shrink-0 text-muted-foreground">{d.label}</dt>
                <dd className="min-w-0 flex-1 break-words">{d.value}</dd>
              </div>
            ))}
          </dl>
        </Block>
      )}

      <List>
        <Row to={subjectPath(f)} onClick={undefined} avatar={<Avatar icon={Users} tone="primary" />} title="Open the lead" sub={subjectLabel(f)} end={<ChevronRight className="h-5 w-5 text-muted-foreground" />} />
        {pending && onEdit && (
          <Row onClick={() => onEdit(f)} avatar={<Avatar icon={Pencil} tone="muted" />} title="Move it" sub="Change the date, time or purpose" end={<ChevronRight className="h-5 w-5 text-muted-foreground" />} />
        )}
        {pending && onCloseFollowup && (
          <Row onClick={() => onCloseFollowup(f)} avatar={<Avatar icon={XCircle} tone="danger" />} title="Close follow-up" sub="No longer needed — say why" end={<ChevronRight className="h-5 w-5 text-muted-foreground" />} />
        )}
      </List>

      {can("sales.comments.view") && (
        <Block title="Discussion">
          <div className="p-4 pt-2">
            <CommentThread entityType="followup" entityId={f.id} />
          </div>
        </Block>
      )}
      <div className="h-2" aria-hidden />
    </div>
  );
}
