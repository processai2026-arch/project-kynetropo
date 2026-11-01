/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActionDialog } from "@/components/ActionDialog";
import { opsPitchesApi } from "@/lib/api/ops";
import type { OpsPitch } from "@/types/ops";

export const PITCH_TYPES: Record<string, string> = {
  yes_meeting: "YES Meeting", business_forum: "Business Forum",
  cold_outreach: "Cold Outreach", referral_event: "Referral Event",
  online: "Online", other: "Other",
};

export const inr = (n: number | null | undefined) => "₹" + Math.round(Number(n ?? 0)).toLocaleString("en-IN");

/** ROI as a signed percent, green when the event paid for itself. */
export function RoiText({ roi, className = "" }: { roi: number | null | undefined; className?: string }) {
  if (roi == null) return <span className={className}>—</span>;
  return (
    <span className={`font-medium ${roi >= 0 ? "text-emerald-700" : "text-red-600"} ${className}`}>
      {roi >= 0 ? "+" : ""}{roi}%
    </span>
  );
}

const EMPTY = { name: "", date: "", venue: "", city: "", type: "yes_meeting", spend: 0, description: "" };

/** Add or edit a pitch event. */
export function PitchFormDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: OpsPitch | null;
  onSaved: (pitch: OpsPitch) => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing
      ? { name: editing.name, date: editing.date, venue: editing.venue ?? "", city: editing.city ?? "",
          type: editing.type, spend: editing.spend, description: editing.description ?? "" }
      : EMPTY);
  }, [open, editing]);

  const set = (k: keyof typeof EMPTY, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Event name required"); return; }
    if (!form.date)        { toast.error("Date required"); return; }
    setSaving(true);
    try {
      const res = editing
        ? await opsPitchesApi.update(editing.id, form as Partial<OpsPitch>)
        : await opsPitchesApi.create(form as Partial<OpsPitch>);
      toast.success(editing ? "Pitch updated" : "Pitch added");
      onOpenChange(false);
      onSaved(res.data);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally       { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>{editing ? "Edit Pitch" : "Add Pitch Event"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Event Name *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. YES Meet Kanchipuram" />
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PITCH_TYPES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Venue</Label>
              <Input value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Venue name" />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Chennai" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Spend (₹) — travel, food, registration</Label>
              <Input type="number" value={form.spend || ""} onChange={(e) => set("spend", Number(e.target.value))} placeholder="0" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Who you met, what worked, observations…" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Add Pitch"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Delete a pitch event. Its leads and customers stay (with their source
 * text); its spend can leave Expenses with it, or stay there.
 */
export function PitchDeleteDialog({ pitch, onOpenChange, onDeleted }: {
  pitch: OpsPitch | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [removeExpense, setRemoveExpense] = useState(true);
  useEffect(() => { if (pitch) setRemoveExpense(true); }, [pitch]);

  return (
    <ActionDialog
      open={pitch !== null}
      onOpenChange={onOpenChange}
      title={pitch ? `Delete ${pitch.name}?` : "Delete pitch event?"}
      destructive
      confirmLabel="Delete event"
      successMessage="Pitch event deleted"
      description={pitch && <div className="space-y-2">
        <p>
          {pitch.leads_count > 0
            ? <>Its {pitch.leads_count} lead{pitch.leads_count === 1 ? "" : "s"} and customers stay, but no longer count toward any event.</>
            : <>No leads came from this event.</>}
        </p>
        <p>This cannot be undone.</p>
      </div>}
      onConfirm={async () => {
        if (!pitch) return;
        await opsPitchesApi.remove(pitch.id, pitch.spend > 0 && removeExpense);
        onDeleted();
      }}
    >
      {pitch && pitch.spend > 0 && (
        <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
          <Checkbox checked={removeExpense} onCheckedChange={(v) => setRemoveExpense(v === true)} className="mt-0.5" />
          <span>
            Also remove its {inr(pitch.spend)} spend from Finance → Expenses
            <span className="block text-xs text-muted-foreground">Untick if the money was really spent and should stay in the books.</span>
          </span>
        </label>
      )}
    </ActionDialog>
  );
}
