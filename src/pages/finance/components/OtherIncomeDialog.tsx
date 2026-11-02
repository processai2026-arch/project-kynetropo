import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { opsFinanceApi } from "@/lib/api/ops";
import type { OpsOtherIncome } from "@/types/ops";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Add other income (income = null), or change or delete one; shut when
 * income is undefined.
 */
export function OtherIncomeDialog({ income, onOpenChange, onSaved }: {
  income: OpsOtherIncome | null | undefined;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ date: today(), amount: "", source: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const open = income !== undefined;

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setForm(income
      ? { date: income.date, amount: String(income.amount), source: income.source, notes: income.notes ?? "" }
      : { date: today(), amount: "", source: "", notes: "" });
  }, [open, income]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.source.trim()) { toast.error("Say where the money came from"); return; }
    if (!(Number(form.amount) > 0)) { toast.error("Enter the amount"); return; }
    setSaving(true);
    try {
      const body = { date: form.date, amount: Number(form.amount), source: form.source.trim(), notes: form.notes };
      if (income) await opsFinanceApi.updateOtherIncome(income.id, body);
      else await opsFinanceApi.addOtherIncome(body);
      toast.success(income ? "Income updated" : "Income added");
      onOpenChange(false);
      onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not save"); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!income) return;
    setSaving(true);
    try {
      await opsFinanceApi.deleteOtherIncome(income.id);
      toast.success("Income deleted");
      onOpenChange(false);
      onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{income ? "Other income" : "Add other income"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="oi-source">From *</Label>
            <Input id="oi-source" value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="e.g. Stud AI hackathon" maxLength={150} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="oi-amount">Amount (₹) *</Label>
              <Input id="oi-amount" type="number" min={0} value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oi-date">Date *</Label>
              <Input id="oi-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oi-notes">Notes</Label>
            <Textarea id="oi-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Prize, grant, what it was for…" />
          </div>
          <div className="flex items-center gap-2">
            {income && (confirmDelete ? (
              <Button type="button" variant="destructive" size="sm" onClick={() => void remove()} disabled={saving}>Yes, delete it</Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            ))}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : income ? "Save" : "Add income"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
