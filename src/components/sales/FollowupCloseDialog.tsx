import { useEffect, useState } from "react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesFollowupsApi } from "@/lib/api/sales";
import { cn } from "@/lib/utils";
import { formatDate, subjectLabel } from "@/components/sales/SalesBits";
import type { SalesFollowup } from "@/types/sales";

/**
 * Closing a follow-up that is no longer needed — without an answer.
 *
 * Completing says how it went; closing says it will not happen, and why. The
 * reason is required: a follow-up that leaves the queue without one looks
 * exactly like one nobody did. It stays in the history as "Closed".
 */
const REASONS = [
  "Not needed any more",
  "Already spoke to them",
  "They are not interested",
  "Added twice",
] as const;
const OTHER = "Other";

export function FollowupCloseDialog({
  followup,
  onClose,
  onClosed,
}: {
  followup: SalesFollowup | null;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [choice, setChoice] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (followup) {
      setChoice("");
      setNotes("");
    }
  }, [followup]);

  const reason = choice === OTHER ? notes.trim() : [choice, notes.trim()].filter(Boolean).join(" — ");
  const missing = !choice ? "Choose why it is being closed" : choice === OTHER && !notes.trim() ? "Write why it is being closed" : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followup || missing) {
      if (missing) toast.error(missing);
      return;
    }
    setSaving(true);
    try {
      await salesFollowupsApi.cancel(followup.id, reason);
      toast.success("Follow-up closed");
      onClose();
      onClosed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not close the follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={followup !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close follow-up</DialogTitle>
          {followup && (
            <DialogDescription>
              {subjectLabel(followup)} · due {formatDate(followup.due_date)}. It leaves the queue and stays in the history as closed.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Why close it?</Label>
            <div className="grid gap-2">
              {[...REASONS, OTHER].map((r) => (
                <button key={r} type="button" onClick={() => setChoice(r)} aria-pressed={choice === r}
                  className={cn("min-h-11 rounded-xl border px-4 py-2 text-left text-sm font-medium transition-colors",
                    choice === r ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted/50")}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-notes">{choice === OTHER ? "Why?" : "Anything to add? (optional)"}</Label>
            <Textarea id="fc-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={choice === OTHER ? "Why this follow-up is not needed" : ""} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Back</Button>
            <Button type="submit" variant="destructive" disabled={saving || Boolean(missing)}>
              <XCircle className="mr-1.5 h-4 w-4" />
              {saving ? "Closing…" : "Close follow-up"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
