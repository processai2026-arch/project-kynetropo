import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesFollowupsApi } from "@/lib/api/sales";
import { useSalesAccess } from "@/hooks/useSalesAccess";
import { subjectLabel } from "@/components/sales/SalesBits";
import type { FollowupOutcome, SalesFollowup } from "@/types/sales";
import { cn } from "@/lib/utils";

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

interface FormProps {
  followup: SalesFollowup;
  /** Fires once the server has accepted it, so the caller can reload. */
  onCompleted: (outcome: FollowupOutcome, scheduledNext: boolean) => void;
  /** Shows a Cancel button beside Complete (the dialog has one; the follow-up page does not). */
  onCancel?: () => void;
  /** Big buttons for the phone app. */
  large?: boolean;
}

/**
 * The completing form on its own: the dialog wraps it, and the phone app's
 * follow-up page shows it in the page, so the answer and the next follow-up are
 * recorded where the follow-up is being read.
 *
 * The answer is four buttons rather than a drop-down: every choice is visible
 * at once, and on a phone a drop-down's list can open half off the screen.
 */
export function FollowupCompleteForm({ followup, onCompleted, onCancel, large }: FormProps) {
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
    if (!spec) return;

    // Checked here as well as on the server, so the answer comes back at once
    // rather than after a round trip.
    if (spec.notesRequired && notes.trim() === "") {
      toast.error("Say why they are not interested — that reason is the useful part.");
      return;
    }
    if (spec.nextRequired && nextDate === "") {
      toast.error("Nobody answered, so pick a date to try again.");
      return;
    }
    if (nextDate === "" && nextPurpose.trim() !== "" && nextPurpose.trim() !== spec.nextPurpose) {
      toast.error("Pick a date for the next follow-up, or clear what to do next.");
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete the follow-up");
    } finally {
      setSaving(false);
    }
  };

  const OUTCOME_STYLE: Record<FollowupOutcome, string> = {
    interested: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    not_interested: "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    not_picked_up: "border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    completed: "border-primary bg-primary/10 text-primary",
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>How did it go?</Label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How did it go?">
          {OUTCOMES.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={outcome === o.value}
              onClick={() => chooseOutcome(o.value)}
              className={cn("rounded-xl border-2 px-3 text-sm font-medium transition-colors",
                large ? "min-h-12" : "min-h-10",
                outcome === o.value ? OUTCOME_STYLE[o.value] : "border-border bg-card text-foreground hover:bg-muted/50")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nothing else is asked until there is an answer to ask about. */}
      {spec && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`fu-notes-${followup.id}`}>{spec.notesLabel}</Label>
            <Textarea
              id={`fu-notes-${followup.id}`}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={spec.notesHint}
            />
          </div>

          {canEditLead && spec.value === "not_interested" && (
            <label className="flex items-start gap-2.5 rounded-xl bg-muted/50 p-3 text-sm">
              <Checkbox checked={moveLead} onCheckedChange={(v) => setMoveLead(v === true)} className="mt-0.5" />
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
              <Checkbox checked={moveLead} onCheckedChange={(v) => setMoveLead(v === true)} className="mt-0.5" />
              <span>
                Mark this lead hot
                <span className="mt-0.5 block text-xs text-muted-foreground">It moves to the top of everyone&apos;s list.</span>
              </span>
            </label>
          )}

          <div className="space-y-1.5 rounded-xl border p-3">
            <Label>
              {spec.nextLabel}
              {spec.nextRequired && <span className="text-destructive"> *</span>}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" aria-label="Next follow-up date" min={localDate()} value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
              <Input type="time" aria-label="Next follow-up time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
            </div>
            <Label htmlFor={`fu-next-${followup.id}`} className="block pt-1">What to do next</Label>
            <Input
              id={`fu-next-${followup.id}`}
              placeholder="Send the quotation, show a demo, call the owner…"
              maxLength={200}
              value={nextPurpose}
              onChange={(e) => setNextPurpose(e.target.value)}
            />
          </div>
        </>
      )}

      <div className={cn("flex gap-2", large ? "" : "justify-end")}>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        )}
        <Button type="submit" disabled={saving || !spec} className={large ? "h-12 flex-1 text-base" : undefined}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          {saving ? "Saving…" : "Complete"}
        </Button>
      </div>
    </form>
  );
}

interface Props {
  /** The follow-up being completed, or null when the dialog is closed. */
  followup: SalesFollowup | null;
  onClose: () => void;
  /** Fires once the server has accepted it, so the caller can reload. */
  onCompleted: (outcome: FollowupOutcome, scheduledNext: boolean) => void;
}

export function FollowupCompleteDialog({ followup, onClose, onCompleted }: Props) {
  return (
    <Dialog open={followup !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Follow-Up</DialogTitle>
        </DialogHeader>

        {followup && (
          <>
            {/* The lead's name is not on the row when this opens from the lead's
                own page — it is already the page you are standing on. */}
            {(subjectLabel(followup) !== "—" || followup.purpose) && (
              <p className="text-sm text-muted-foreground">
                {[subjectLabel(followup), followup.purpose].filter(Boolean).join(" — ")}
              </p>
            )}
            <FollowupCompleteForm
              followup={followup}
              onCancel={onClose}
              onCompleted={(outcome, next) => { onCompleted(outcome, next); onClose(); }}
            />
          </>
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
