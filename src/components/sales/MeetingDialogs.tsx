import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { salesMeetingsApi } from "@/lib/api/sales";
import { useTeamMembers, namesakeHint } from "@/hooks/useTeamMembers";
import { humanise } from "@/components/sales/SalesBits";
import type { SalesMeeting } from "@/types/sales";

/**
 * Booking a meeting, moving one, and writing down how it went.
 *
 * Shared between the lead page and the Meetings list. Both screens need all
 * three, and the outcome form in particular is not something to keep two
 * copies of: it is the form that decides whether another meeting and another
 * follow-up get created.
 */

const MEETING_OUTCOMES = ["positive", "neutral", "negative", "rescheduled", "no_show", "other"] as const;

/** Today, from the local clock — toISOString() is UTC and names yesterday here after 18:30. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const BLANK_MEETING = {
  title: "",
  meeting_type: "virtual",
  meeting_date: today(),
  meeting_time: "10:30",
  place: "",
  meeting_link: "",
  participants: "",
  notes: "",
};

const BLANK_OUTCOME = {
  outcome: "positive",
  outcome_notes: "",
  requirements: "",
  decisions: "",
  next_action: "",
  next_meeting_date: "",
  next_meeting_time: "",
  next_followup_date: "",
  next_followup_time: "",
};

/**
 * Schedule a new meeting, or move an existing one.
 *
 * Passing a `meeting` switches it to editing that one — which is how a meeting
 * gets rescheduled or has a mistyped link corrected. There was previously no
 * way to do either: the endpoint existed but nothing in the app called it.
 */
export function MeetingFormDialog({
  open,
  leadId,
  leadLabel,
  meeting,
  onClose,
  onSaved,
}: {
  open: boolean;
  leadId: number;
  /** Company or contact name, used for the default title. */
  leadLabel?: string | null;
  /** Null to schedule a new one; a meeting to edit that one. */
  meeting?: SalesMeeting | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = meeting != null;
  const [form, setForm] = useState(BLANK_MEETING);
  const [going, setGoing] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const people = useTeamMembers(open);

  // Reset every time the dialog opens. Without this the form kept whatever was
  // typed last time, so scheduling a second meeting on the same lead started
  // pre-filled with the first one's title, link and notes.
  useEffect(() => {
    if (!open) return;
    setForm(
      meeting
        ? {
            title: meeting.title,
            meeting_type: meeting.meeting_type,
            meeting_date: meeting.meeting_date,
            meeting_time: (meeting.meeting_time ?? "").slice(0, 5),
            place: meeting.place ?? "",
            meeting_link: meeting.meeting_link ?? "",
            participants: meeting.participants ?? "",
            notes: meeting.notes ?? "",
          }
        : { ...BLANK_MEETING },
    );
    setGoing((meeting?.participant_users ?? []).map((p) => p.user_id));
  }, [open, meeting]);

  const set = (k: keyof typeof BLANK_MEETING, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        title: form.title.trim() || `Meeting with ${leadLabel ?? "lead"}`,
        meeting_type: form.meeting_type,
        meeting_date: form.meeting_date,
        meeting_time: form.meeting_time || undefined,
        place: form.meeting_type === "physical" ? form.place : undefined,
        meeting_link: form.meeting_type === "virtual" ? form.meeting_link : undefined,
        participants: form.participants || undefined,
        participant_ids: going,
        notes: form.notes || undefined,
      };
      if (editing && meeting) {
        await salesMeetingsApi.update(meeting.id, body);
        toast.success("Meeting updated");
      } else {
        await salesMeetingsApi.create({ ...body, lead_id: leadId });
        toast.success("Meeting scheduled");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the meeting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left">{editing ? "Edit Meeting" : "Schedule Meeting"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Title</Label>
            <Input
              id="m-title"
              value={form.title}
              placeholder={`Meeting with ${leadLabel ?? "lead"}`}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.meeting_type} onValueChange={(v) => set("meeting_type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="virtual">Virtual</SelectItem>
                <SelectItem value="physical">Physical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-date">Date</Label>
              <Input
                id="m-date"
                type="date"
                required
                value={form.meeting_date}
                onChange={(e) => set("meeting_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-time">Time</Label>
              <Input
                id="m-time"
                type="time"
                value={form.meeting_time}
                onChange={(e) => set("meeting_time", e.target.value)}
              />
            </div>
          </div>

          {/* Physical → place; virtual → link. */}
          {form.meeting_type === "physical" ? (
            <div className="space-y-1.5">
              <Label htmlFor="m-place">Meeting place *</Label>
              <Input id="m-place" required value={form.place} onChange={(e) => set("place", e.target.value)} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="m-link">Meeting link *</Label>
              {/*
                Deliberately not type="url": that demands a scheme, so pasting
                "meet.google.com/abc-defg" was rejected while a mistyped
                "htttps://…" sailed through as a valid URL and was saved as a
                dead link. The server completes a bare address and refuses
                anything that is not one.
              */}
              <Input
                id="m-link"
                type="text"
                inputMode="url"
                required
                placeholder="https://meet.google.com/…"
                value={form.meeting_link}
                onChange={(e) => set("meeting_link", e.target.value)}
              />
            </div>
          )}

          {/*
            Naming a colleague here puts the meeting in their diary — it shows
            on their dashboard and in their Meetings list. Without it a meeting
            booked by one person for another was invisible to the person
            actually attending.
          */}
          <div className="space-y-1.5">
            <Label>Who from our team is going</Label>
            {people.length === 0 ? (
              <p className="text-xs text-muted-foreground">Loading people…</p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border p-2">
                {people.map((p) => (
                  <label
                    key={p.user_id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
                  >
                    <Checkbox
                      checked={going.includes(p.user_id)}
                      onCheckedChange={() =>
                        setGoing((g) =>
                          g.includes(p.user_id) ? g.filter((x) => x !== p.user_id) : [...g, p.user_id],
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block text-sm">{p.name}</span>
                      {/* Two people with the same name means one of them gets a
                          meeting they know nothing about. */}
                      {namesakeHint(p) && (
                        <span className="block text-[11px] text-muted-foreground">{namesakeHint(p)}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              {going.length === 0
                ? "Nobody added — it stays with whoever owns the lead."
                : `It will show on ${going.length} ${going.length === 1 ? "person's" : "people's"} dashboard.`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-participants">Anyone else attending</Label>
            <Input
              id="m-participants"
              value={form.participants}
              placeholder="People from their side"
              onChange={(e) => set("participants", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-notes">Notes</Label>
            <Textarea id="m-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Schedule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Wrapping up a meeting that has happened. */
export function MeetingOutcomeDialog({
  open,
  meeting,
  onClose,
  onSaved,
}: {
  open: boolean;
  meeting: SalesMeeting | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(BLANK_OUTCOME);
  const [saving, setSaving] = useState(false);

  // Cleared on every open, and this one matters: the form carries two dates
  // that create records. Left holding the previous meeting's answers, a second
  // wrap-up would quietly book another meeting and another follow-up that
  // nobody had asked for.
  useEffect(() => {
    if (!open) return;
    setForm({ ...BLANK_OUTCOME });
  }, [open, meeting?.id]);

  const set = (k: keyof typeof BLANK_OUTCOME, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting) return;
    setSaving(true);
    try {
      await salesMeetingsApi.complete(meeting.id, {
        outcome: form.outcome,
        outcome_notes: form.outcome_notes || undefined,
        requirements: form.requirements || undefined,
        decisions: form.decisions || undefined,
        next_action: form.next_action || undefined,
        next_meeting_date: form.next_meeting_date || undefined,
        next_meeting_time: form.next_meeting_time || undefined,
        next_followup_date: form.next_followup_date || undefined,
        next_followup_time: form.next_followup_time || undefined,
      });
      toast.success("Meeting outcome recorded");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record the outcome");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open && meeting !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left">
            Meeting Outcome
            {meeting && <span className="block text-sm font-normal text-muted-foreground">{meeting.title}</span>}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Outcome</Label>
            <Select value={form.outcome} onValueChange={(v) => set("outcome", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEETING_OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {humanise(o)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-notes">Notes</Label>
            <Textarea
              id="o-notes"
              rows={3}
              value={form.outcome_notes}
              onChange={(e) => set("outcome_notes", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-req">Requirements</Label>
            <Textarea
              id="o-req"
              rows={2}
              value={form.requirements}
              onChange={(e) => set("requirements", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-dec">Decisions</Label>
            <Textarea id="o-dec" rows={2} value={form.decisions} onChange={(e) => set("decisions", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="o-next">Next action</Label>
            <Input id="o-next" value={form.next_action} onChange={(e) => set("next_action", e.target.value)} />
          </div>

          <div className="space-y-3 rounded-xl bg-muted/50 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="o-nm">Next meeting (optional)</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="o-nm"
                  type="date"
                  aria-label="Next meeting date"
                  min={today()}
                  value={form.next_meeting_date}
                  onChange={(e) => set("next_meeting_date", e.target.value)}
                />
                <Input
                  id="o-nm-time"
                  type="time"
                  aria-label="Next meeting time"
                  value={form.next_meeting_time}
                  onChange={(e) => set("next_meeting_time", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="o-nf">Next follow-up (optional)</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="o-nf"
                  type="date"
                  aria-label="Next follow-up date"
                  min={today()}
                  value={form.next_followup_date}
                  onChange={(e) => set("next_followup_date", e.target.value)}
                />
                <Input
                  id="o-nf-time"
                  type="time"
                  aria-label="Next follow-up time"
                  value={form.next_followup_time}
                  onChange={(e) => set("next_followup_time", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Outcome"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
