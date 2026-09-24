import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CalendarX, MapPin, Pencil, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { salesMeetingsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { SalesLayout } from "@/components/sales/SalesLayout";
import { MeetingFormDialog, MeetingOutcomeDialog } from "@/components/sales/MeetingDialogs";
import { useConfirm } from "@/components/ConfirmDialog";
import { CommentButton, CommentThreadDialog } from "@/components/sales/CommentThread";
import { MeetingLink, TemperatureBadge, formatDate, formatTime, humanise } from "@/components/sales/SalesBits";
import type { SalesMeeting } from "@/types/sales";
import { cn } from "@/lib/utils";

/**
 * The sales diary.
 *
 * It used to be a read-only list: a meeting could be booked from a lead, but
 * from here there was no way to write down how it went, move it, or call it
 * off — you had to find the lead first. Working a day of meetings means going
 * down this list, so the actions belong on it.
 */
export default function SalesMeetings() {
  const { can } = useSalesAccess();
  const confirm = useConfirm();
  const [items, setItems] = useState<SalesMeeting[]>([]);
  const [thread, setThread] = useState<SalesMeeting | null>(null);
  const [outcomeMeeting, setOutcomeMeeting] = useState<SalesMeeting | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<SalesMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("scheduled");
  const [type, setType] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesMeetingsApi.list({
        status: status !== "all" ? status : undefined,
        meeting_type: type !== "all" ? type : undefined,
      });
      setItems(res.items ?? []);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load meetings";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [status, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancelMeeting = async (m: SalesMeeting) => {
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel the meeting");
    }
  };

  return (
    <SalesLayout>
      <h1 className="text-2xl font-bold text-foreground">Meetings</h1>

      <div className="grid grid-cols-2 gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="physical">Physical</SelectItem>
            <SelectItem value="virtual">Virtual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No meetings here. Schedule one from a lead.
          </p>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
          {items.map((m) => (
            <div key={m.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/sales/leads/${m.lead_id}`} className="min-w-0 hover:underline">
                  <p className="truncate font-semibold text-card-foreground">{m.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.lead_company || m.lead_name}</p>
                </Link>
                {m.lead_temperature && <TemperatureBadge value={m.lead_temperature} />}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  {m.meeting_type === "virtual" ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                  {humanise(m.meeting_type)}
                </span>
                <span>
                  {formatDate(m.meeting_date)}
                  {m.meeting_time ? ` · ${formatTime(m.meeting_time)}` : ""}
                </span>
                <span
                  className={cn(
                    "capitalize",
                    m.status === "completed" && "text-emerald-700",
                    m.status === "cancelled" && "text-muted-foreground line-through",
                  )}
                >
                  {m.status}
                </span>
              </div>

              {m.meeting_type === "physical" && m.place && (
                <p className="mt-2 text-sm text-muted-foreground">{m.place}</p>
              )}
              {m.meeting_type === "virtual" && m.meeting_link && (
                <MeetingLink href={m.meeting_link} className="mt-2 text-sm" />
              )}

              {(m.participant_users?.length ?? 0) > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Going: {m.participant_users!.map((p) => p.name).join(", ")}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {can("sales.comments.view") && (
                  <CommentButton count={m.comment_count ?? 0} onClick={() => setThread(m)} />
                )}
                {m.status === "scheduled" && can("sales.meetings.edit") && (
                  <>
                    <Button size="sm" className="h-9" onClick={() => setOutcomeMeeting(m)}>
                      How did it go?
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2"
                      aria-label="Edit meeting"
                      title="Move it, or fix the link"
                      onClick={() => setEditingMeeting(m)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2 text-destructive hover:text-destructive"
                      aria-label="Cancel meeting"
                      title="Call it off"
                      onClick={() => void cancelMeeting(m)}
                    >
                      <CalendarX className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {m.status === "completed" && m.outcome && (
                <div className="mt-3 rounded-xl bg-muted/50 p-3 text-xs">
                  <p className="font-medium text-foreground">Outcome: {humanise(m.outcome)}</p>
                  {m.outcome_notes && <p className="mt-1 text-muted-foreground">{m.outcome_notes}</p>}
                  {m.next_action && <p className="mt-1 text-muted-foreground">Next: {m.next_action}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <MeetingOutcomeDialog
        open={outcomeMeeting !== null}
        meeting={outcomeMeeting}
        onClose={() => setOutcomeMeeting(null)}
        onSaved={() => void load()}
      />

      <MeetingFormDialog
        open={editingMeeting !== null}
        leadId={editingMeeting?.lead_id ?? 0}
        leadLabel={editingMeeting?.lead_company || editingMeeting?.lead_name}
        meeting={editingMeeting}
        onClose={() => setEditingMeeting(null)}
        onSaved={() => void load()}
      />

      <CommentThreadDialog
        open={thread !== null}
        onOpenChange={(o) => {
          if (!o) {
            setThread(null);
            void load();
          }
        }}
        title={thread?.title ?? "Comments"}
        entityType="meeting"
        entityId={thread?.id ?? 0}
      />
    </SalesLayout>
  );
}
