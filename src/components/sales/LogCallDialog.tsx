import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { salesCallsApi } from "@/lib/api/sales";
import { humanise } from "@/components/sales/SalesBits";

/**
 * Logging a call, wherever you happen to be when you make it.
 *
 * This used to live only on the lead page, so the "Log Call" button on a
 * follow-up navigated there and dropped you on the lead once you were done —
 * two screens away from the list you were working through. One dialog, opened
 * in place, keeps you where the work is.
 *
 * Shared rather than copied: a call logged from a follow-up and a call logged
 * from the lead are the same act, and two forms would eventually disagree
 * about which fields it has.
 */

const CALL_OUTCOMES = [
  "interested", "follow_up_required", "meeting_required", "proposal_required",
  "not_interested", "no_response", "call_back_later", "converted", "other",
] as const;

/**
 * Today, from the local clock.
 *
 * Deliberately not toISOString(): that is UTC, and for anyone east of
 * Greenwich working late evening it names yesterday.
 */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

const EMPTY = {
  call_date: "",
  call_time: "",
  duration_minutes: "",
  outcome: "interested",
  notes: "",
  temperature_after: "",
  next_followup_date: "",
  next_followup_time: "",
};

export function LogCallDialog({
  open,
  lead,
  onClose,
  onLogged,
}: {
  open: boolean;
  /** Who the call was with. Null keeps the dialog closed. */
  lead: { id: number; name?: string | null; company?: string | null } | null;
  onClose: () => void;
  /** Called after the call is saved, so the caller can refresh its list. */
  onLogged: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, call_date: today(), call_time: nowTime() });
  }, [open, lead?.id]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setSaving(true);
    try {
      await salesCallsApi.log({
        lead_id: lead.id,
        call_date: form.call_date,
        call_time: form.call_time || undefined,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : 0,
        outcome: form.outcome,
        notes: form.notes || undefined,
        temperature_after: form.temperature_after || undefined,
        next_followup_date: form.next_followup_date || undefined,
        next_followup_time: form.next_followup_time || undefined,
      });
      toast.success(
        form.next_followup_date
          ? "Call logged, and the next follow-up is scheduled"
          : "Call logged",
      );
      onLogged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log the call");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open && lead !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left">
            Log Call
            {lead && (lead.company || lead.name) && (
              <span className="block text-sm font-normal text-muted-foreground">
                {lead.company || lead.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lc-date">Date</Label>
              <Input
                id="lc-date"
                type="date"
                required
                value={form.call_date}
                onChange={(e) => set("call_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lc-time">Time</Label>
              <Input
                id="lc-time"
                type="time"
                value={form.call_time}
                onChange={(e) => set("call_time", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lc-duration">Duration (min)</Label>
              <Input
                id="lc-duration"
                type="number"
                min={0}
                max={1440}
                inputMode="numeric"
                value={form.duration_minutes}
                onChange={(e) => set("duration_minutes", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Select value={form.outcome} onValueChange={(v) => set("outcome", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALL_OUTCOMES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {humanise(o)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lc-notes">Notes — what was discussed?</Label>
            <Textarea
              id="lc-notes"
              rows={4}
              placeholder="Requirement, budget, timeline, objections, next action…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Update temperature (optional)</Label>
            <Select
              value={form.temperature_after || "unchanged"}
              onValueChange={(v) => set("temperature_after", v === "unchanged" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged">Leave unchanged</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="lc-next">Next follow-up</Label>
              <Input
                id="lc-next"
                type="date"
                min={today()}
                value={form.next_followup_date}
                onChange={(e) => set("next_followup_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lc-next-time">Time (optional)</Label>
              <Input
                id="lc-next-time"
                type="time"
                value={form.next_followup_time}
                onChange={(e) => set("next_followup_time", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Call"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
