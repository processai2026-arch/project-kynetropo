import type React from "react";
import { FileMinus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditNoteForm {
  credit_note_date: string;   // ISO date "YYYY-MM-DD"
  amount: string;             // Pre-tax amount as string (for controlled input)
  gst_rate: string;           // GST percentage as string e.g. "18"
  reason: string;             // Short reason label
  notes: string;              // Optional long-form notes
}

export interface IssueCreditNoteDialogProps {
  /** Controls dialog visibility. */
  open: boolean;
  /** Called when the dialog requests to open or close. */
  onOpenChange: (open: boolean) => void;
  /** Invoice reference displayed in the subtitle. */
  invoiceId: string | number;
  /** Controlled form state owned by the parent. */
  form: CreditNoteForm;
  /**
   * Functional state updater — pass your `setForm` setter directly.
   * Typed as `React.Dispatch<React.SetStateAction<CreditNoteForm>>` so the
   * parent can wire it up with zero boilerplate.
   */
  onFormChange: React.Dispatch<React.SetStateAction<CreditNoteForm>>;
  /** Called when the user clicks "Issue Credit Note". Validation lives in the parent. */
  onIssue: () => void;
  /** While true, all controls are disabled and the submit button shows a spinner. */
  isSaving: boolean;
  /** Array of GST rate options rendered in the dropdown, e.g. [0, 5, 12, 18, 28]. */
  GST_RATES: number[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IssueCreditNoteDialog({
  open,
  onOpenChange,
  invoiceId,
  form,
  onFormChange,
  onIssue,
  isSaving,
  GST_RATES,
}: IssueCreditNoteDialogProps) {
  /** Merge a single field update into form state using the functional updater. */
  const set = (key: keyof CreditNoteForm, value: string) =>
    onFormChange((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isSaving) onOpenChange(v);
      }}
    >
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileMinus className="h-5 w-5" />
            Issue Credit Note
          </DialogTitle>
          <DialogDescription>
            Reduces the receivable balance of invoice{" "}
            <span className="font-medium text-foreground">{invoiceId}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* ----------------------------------------------------------------
            Fields
        ----------------------------------------------------------------- */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.credit_note_date}
                onChange={(e) => set("credit_note_date", e.target.value)}
                disabled={isSaving}
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
                disabled={isSaving}
              />
            </div>

            {/* GST Rate */}
            <div className="space-y-1.5">
              <Label className="text-xs">GST Rate</Label>
              <Select
                value={form.gst_rate}
                onValueChange={(v) => set("gst_rate", v)}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent>
                  {GST_RATES.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Input
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
                placeholder="e.g. Returned goods"
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Notes — full width */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional additional details…"
              rows={3}
              disabled={isSaving}
            />
          </div>
        </div>

        {/* ----------------------------------------------------------------
            Footer
        ----------------------------------------------------------------- */}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={onIssue} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FileMinus className="h-4 w-4 mr-2" />
            )}
            Issue Credit Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default IssueCreditNoteDialog;
