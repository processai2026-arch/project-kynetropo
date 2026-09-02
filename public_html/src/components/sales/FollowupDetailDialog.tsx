import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, Phone, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { CommentThread } from "@/components/sales/CommentThread";
import { FollowupEditNote } from "@/components/sales/FollowupEditDialog";
import {
  TemperatureBadge,
  formatDate,
  formatDateTime,
  formatTime,
  humanise,
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
}: {
  followup: SalesFollowup | null;
  onClose: () => void;
}) {
  const { can } = useSalesAccess();
  const f = followup;

  return (
    <Dialog open={f !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {f && (
          <>
            <DialogHeader>
              <DialogTitle className="text-left">
                <span className="block truncate">{f.lead_company || f.lead_name}</span>
                <span className="block text-sm font-normal text-muted-foreground">
                  {f.status === "completed" ? "Completed follow-up" : "Follow-up"}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-card-foreground">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  {formatDate(f.due_date)}
                  {f.due_time ? ` · ${formatTime(f.due_time)}` : ""}
                </span>
                {f.lead_temperature && <TemperatureBadge value={f.lead_temperature} />}
              </div>

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
                  <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed {formatDateTime(f.completed_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {f.outcome_notes || "No outcome notes were written."}
                  </p>
                </div>
              )}

              <Link
                to={`/sales/leads/${f.lead_id}`}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
