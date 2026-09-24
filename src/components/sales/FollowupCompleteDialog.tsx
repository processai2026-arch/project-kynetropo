import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesFollowupsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { subjectLabel } from "@/components/sales/SalesBits";
import type { FollowupOutcome, SalesFollowup } from "@/types/sales";

/**
 * Completing a follow-up, with the answer recorded as an answer.
 *
 * "Complete" on its own says the box was ticked, not what happened — and a
 * sentence typed into a notes field cannot be counted, filtered or shown on a
 * card. So the outcome is asked for first, and each outcome then asks for the
 * one thing it actually needs: a reason when they said no, a retry date when
 * nobody answered, a next step when they said yes. Each of those lands in its
 * own field rather than all of them landing in the notes.
 */

const OUTCOMES: {
  value: FollowupOutcome;
  label: string;
  /** What this outcome needs from the person, in the words of the moment. */
  notesLabel: string;
  notesHint: string;
  notesRequired: boolean;
  nextLabel: string;
  nextRequired: boolean;
  /** Days ahead the next follow-up is pencilled in, or null to leave it blank. */
  nextDefaultDays: number | null;
  nextPurpose: string;
}[] = [
  {
    value: "interested",
    label: "Interested",
    notesLabel: "What are they interested in?",
    notesHint: "Requirement, budget, timeline, who else decides…",
    notesRequired: false,
    nextLabel: "Next follow-up",
    nextRequired: false,
    nextDefaultDays: 2,
    nextPurpose: "Continue — they are interested",
  },
  {
    value: "not_interested",
    label: "Not interested",
    notesLabel: "Why aren't they interested?",
    notesHint: "Price, timing, they have something already, no longer a fit…",
    notesRequired: true,
    nextLabel: "Check back later (optional)",
    nextRequired: false,
    nextDefaultDays: null,
    nextPurpose: "Check back later",
  },
  {
    value: "not_picked_up",
    label: "Not picked up",
    notesLabel: "Anything to note? (optional)",
    notesHint: "Rang out, switched off, wrong number, asked to call later…",
    notesRequired: false,
    nextLabel: "When will you try again?",
    nextRequired: true,
    nextDefaultDays: 1,
    nextPurpose: "Try again — no answer",
  },
  {
    value: "completed",
    label: "Completed",
    notesLabel: "What happened? (optional)",
    notesHint: "What was done, and anything the next person should know.",
    notesRequired: false,
    nextLabel: "Next follow-up (optional)",
    nextRequired: false,
    nextDefaultDays: null,
    nextPurpose: "",
  },
];

/** Today from the local clock — toISOString() is UTC, and names yesterday
 *  for anyone east of Greenwich working in the evening. */
function localDate(daysAhead = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  /** The follow-up being completed, or null when the dialog is closed. */
  followup: SalesFollowup | null;
  onClose: () => void;
  /** Fires once the server has accepted it, so the caller can reload. */
  onCompleted: (outcome: FollowupOutcome, scheduledNext: boolean) => void;
}

export function FollowupCompleteDialog({ followup, onClose, onCompleted }: Props) {
  const { can } = useSalesAccess();
  const [outcome, setOutcome] = useState<FollowupOutcome | "">("");
  const [notes, setNotes] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");
  const [nextPurpose, setNextPurpose] = useState("");
  const [moveLead, setMoveLead] = useState(true);
  const [saving, setSaving] = useState(false);

  const spec = OUTCOMES.find((o) => o.value === outcome) ?? null;

  // Moving the lead is a lead edit; without that permission the server refuses
  // it, so the offer is not made.
  const canEditLead = can("sales.leads.edit");

  // Reset on open. The form can book a second follow-up and move a lead, so a
  // value left behind from the last one would do both to the wrong person.
  useEffect(() => {
    if (!followup) return;
    setOutcome("");
    setNotes("");
    setNextDate("");
    setNextTime(followup.due_time ? followup.due_time.slice(0, 5) : "");
    setNextPurpose("");
    setMoveLead(true);
    setSaving(false);
  }, [followup]);

  /** Picking an answer pencils in the date that answer usually implies. */
  const chooseOutcome = (value: FollowupOutcome) => {
    setOutcome(value);
    const next = OUTCOMES.find((o) => o.value === value);
    if (!next) return;
    setNextDate(next.nextDefaultDays !== null ? localDate(next.nextDefaultDays) : "");
    setNextPurpose(next.nextPurpose);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followup || !spec) return;

    // Checked here as well as on the server, so the answer comes back as a
    // sentence under the field rather than as a toast over a form you then
    // have to hunt through.
    if (spec.notesRequired && notes.trim() === "") {
      toast.error("Say why they are not interested — that reason is the useful part.");
      return;
    }
    if (spec.nextRequired && nextDate === "") {
      toast.error("Nobody answered, so pick a date to try again.");
      return;
    }

    setSaving(true);
    try {
      await salesFollowupsApi.complete(followup.id, {
        outcome: spec.value,
        outcome_notes: notes.trim() || undefined,
        next_followup_date: nextDate || undefined,
        next_followup_time: nextDate && nextTime ? nextTime : undefined,
        next_followup_purpose: nextDate ? nextPurpose.trim() || undefined : undefined,
        mark_lead_lost: spec.value === "not_interested" && moveLead && canEditLead ? true : undefined,
        mark_lead_hot: spec.value === "interested" && moveLead && canEditLead ? true : undefined,
      });
      toast.success(nextDate ? `Saved — next follow-up ${nextDate}` : "Follow-up completed");
      onCompleted(spec.value, nextDate !== "");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete the follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={followup !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Follow-Up</DialogTitle>
        </DialogHeader>

        {followup && (
          <form onSubmit={submit} className="space-y-4">
            {/* The lead's name is not on the row when this opens from the lead's
                own page — it is already the page you are standing on. */}
            {(subjectLabel(followup) !== "—" || followup.purpose) && (
              <p className="text-sm text-muted-foreground">
                {[subjectLabel(followup), followup.purpose]
                  .filter(Boolean)
                  .join(" — ")}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="fu-outcome">How did it go?</Label>
              <Select value={outcome} onValueChange={(v) => chooseOutcome(v as FollowupOutcome)}>
                <SelectTrigger id="fu-outcome">
                  <SelectValue placeholder="Pick an outcome" />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nothing else is asked until there is an answer to ask about. */}
            {spec && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fu-notes">{spec.notesLabel}</Label>
                  <Textarea
                    id="fu-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={spec.notesHint}
                  />
                </div>

                {canEditLead && spec.value === "not_interested" && (
                  <label className="flex items-start gap-2.5 rounded-xl bg-muted/50 p-3 text-sm">
                    <Checkbox
                      checked={moveLead}
                      onCheckedChange={(v) => setMoveLead(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Mark this lead as lost
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        It leaves the working pipeline, with your reason on its timeline. Reopen it
                        any time by changing the status back.
                      </span>
                    </span>
                  </label>
                )}

                {canEditLead && spec.value === "interested" && (
                  <label className="flex items-start gap-2.5 rounded-xl bg-muted/50 p-3 text-sm">
                    <Checkbox
                      checked={moveLead}
                      onCheckedChange={(v) => setMoveLead(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      Mark this lead hot
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        It moves to the top of everyone's list.
                      </span>
                    </span>
                  </label>
                )}

                <div className="space-y-1.5">
                  <Label>
                    {spec.nextLabel}
                    {spec.nextRequired && <span className="text-destructive"> *</span>}
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="date"
                      aria-label="Next follow-up date"
                      min={localDate()}
                      value={nextDate}
                      onChange={(e) => setNextDate(e.target.value)}
                    />
                    <Input
                      type="time"
                      aria-label="Next follow-up time"
                      value={nextTime}
                      onChange={(e) => setNextTime(e.target.value)}
                    />
                  </div>
                  {/* Only worth asking once there is a follow-up to describe. */}
                  {nextDate !== "" && (
                    <Input
                      className="mt-2"
                      aria-label="What is the next follow-up for?"
                      placeholder="What is it for?"
                      maxLength={200}
                      value={nextPurpose}
                      onChange={(e) => setNextPurpose(e.target.value)}
                    />
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !spec}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {saving ? "Saving…" : "Complete"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The outcome as a badge — the same colours wherever a follow-up is shown. */
export function OutcomeBadge({ value, className }: { value?: string | null; className?: string }) {
  const spec = OUTCOMES.find((o) => o.value === value);
  if (!spec) return null;
  const tone =
    spec.value === "interested"
      ? "bg-emerald-100 text-emerald-800"
      : spec.value === "not_interested"
        ? "bg-rose-100 text-rose-800"
        : spec.value === "not_picked_up"
          ? "bg-amber-100 text-amber-900"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone} ${className ?? ""}`}
    >
      {spec.label}
    </span>
  );
}
