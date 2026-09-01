import { useEffect, useState } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesFollowupsApi } from "@/lib/api/sales";
import type { SalesFollowup, SalesMe } from "@/types/sales";
import { cn } from "@/lib/utils";

/**
 * Edit a pending follow-up — date, time, purpose, and why.
 *
 * Two rules the server also enforces, so the UI and the API cannot disagree:
 *
 *  - Only the person the follow-up belongs to may edit it (an administrator may
 *    too, and the trail names them when they do). A follow-up is a promise one
 *    person made about one lead; someone else quietly moving the date is how a
 *    commitment goes missing without anyone noticing.
 *  - Every edit carries a reason, and the reason is shown to the whole team.
 *    Without it a rescheduled follow-up is indistinguishable from a missed one,
 *    which is the exact difference the queue exists to make visible.
 */

/** Can this person edit this follow-up? The server decides again on save. */
export function canEditFollowup(followup: SalesFollowup, me: SalesMe | null): boolean {
  if (!me?.user_id) return false;
  if (me.is_admin) return true;
  const owner = followup.owner_id ?? followup.assigned_to ?? followup.created_by ?? null;
  return owner === me.user_id;
}

/** The "edited" line under a follow-up. Everyone sees it, not just the owner. */
export function FollowupEditNote({
  followup,
  className,
}: {
  followup: SalesFollowup;
  className?: string;
}) {
  if (!followup.edited_at) return null;
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-500", className)}>
      <PencilLine className="mt-0.5 h-3 w-3 shrink-0" />
      <span className="min-w-0">
        Edited{followup.edited_by_name ? ` by ${followup.edited_by_name}` : ""}
        {(followup.edit_count ?? 0) > 1 ? ` (${followup.edit_count}×)` : ""}
        {followup.edit_reason ? ` — ${followup.edit_reason}` : ""}
      </span>
    </p>
  );
}

export function FollowupEditDialog({
  followup,
  onClose,
  onSaved,
}: {
  followup: SalesFollowup | null;
  onClose: () => void;
  onSaved: (updated: SalesFollowup | null) => void;
}) {
  const [form, setForm] = useState({ due_date: "", due_time: "", purpose: "", edit_reason: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!followup) return;
    setForm({
      due_date: followup.due_date ?? "",
      // The API stores HH:MM:SS; <input type="time"> wants HH:MM.
      due_time: followup.due_time ? followup.due_time.slice(0, 5) : "",
      purpose: followup.purpose ?? "",
      // Never pre-filled from the last edit: a reason carried over from a
      // previous change would be a lie about this one.
      edit_reason: "",
    });
  }, [followup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followup) return;
    if (!form.due_date) {
      toast.error("A follow-up date is required");
      return;
    }
    if (form.edit_reason.trim().length < 3) {
      toast.error("Say why you are changing it — the team sees this");
      return;
    }
    setSaving(true);
    try {
      const res = await salesFollowupsApi.update(followup.id, {
        due_date: form.due_date,
        due_time: form.due_time,
        purpose: form.purpose,
        edit_reason: form.edit_reason.trim(),
      });
      toast.success("Follow-up updated");
      onSaved(res?.followup ?? null);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the follow-up");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={followup !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Follow-Up</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fu-edit-date">Date</Label>
              <Input
                id="fu-edit-date"
                type="date"
                required
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-edit-time">Time (optional)</Label>
              <Input
                id="fu-edit-time"
                type="time"
                value={form.due_time}
                onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-edit-purpose">Purpose</Label>
            <Textarea
              id="fu-edit-purpose"
              rows={2}
              maxLength={200}
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              placeholder="What is this follow-up for?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-edit-reason">
              Why are you changing it? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="fu-edit-reason"
              rows={2}
              required
              maxLength={300}
              value={form.edit_reason}
              onChange={(e) => setForm((f) => ({ ...f, edit_reason: e.target.value }))}
              placeholder="Customer asked to push it to Friday"
            />
            <p className="text-[11px] text-muted-foreground">
              Shown to the whole team on this follow-up and on the lead timeline.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
