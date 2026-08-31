import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salesFollowupsApi } from "@/lib/api/sales";
import type { SalesFollowup } from "@/types/sales";

/**
 * Edit a pending follow-up — date, time and purpose. Shared by the Follow-Ups
 * queue and the lead detail screen so both edit the same way.
 *
 * Only pending follow-ups are editable; the server enforces that too (409 on a
 * completed or cancelled one), and records the change on the lead timeline so a
 * reschedule never reads as a missed follow-up.
 */
export function FollowupEditDialog({
  followup,
  onClose,
  onSaved,
}: {
  followup: SalesFollowup | null;
  onClose: () => void;
  onSaved: (updated: SalesFollowup | null) => void;
}) {
  const [form, setForm] = useState({ due_date: "", due_time: "", purpose: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!followup) return;
    setForm({
      due_date: followup.due_date ?? "",
      // The API stores HH:MM:SS; <input type="time"> wants HH:MM.
      due_time: followup.due_time ? followup.due_time.slice(0, 5) : "",
      purpose: followup.purpose ?? "",
    });
  }, [followup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followup) return;
    if (!form.due_date) {
      toast.error("A follow-up date is required");
      return;
    }
    setSaving(true);
    try {
      const res = await salesFollowupsApi.update(followup.id, {
        due_date: form.due_date,
        due_time: form.due_time,
        purpose: form.purpose,
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
              rows={3}
              maxLength={200}
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              placeholder="What is this follow-up for?"
            />
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
