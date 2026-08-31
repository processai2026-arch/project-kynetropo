import { Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";

export interface RecordPaymentForm {
  amount: string;
  payment_method: string;
  payment_date: string;
  notes: string;
  reference?: string;
  party_name?: string;
  payment_type?: "received" | "paid" | "refund";
}

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  form: RecordPaymentForm;
  onChange: (field: keyof RecordPaymentForm, value: string) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  /** Show a "Full" button next to the amount that fills the outstanding balance */
  onFillFull?: () => void;
  /** Show the Party Name field (used in standalone payment ledger) */
  showPartyName?: boolean;
  /** Show the Type selector (received / paid / refund) */
  showPaymentType?: boolean;
  /** Show the Reference / UTR field */
  showReference?: boolean;
  /** Use a Textarea for Notes (default: single-line Input) */
  notesMultiline?: boolean;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  saving,
  onSubmit,
  form,
  onChange,
  title = "Record Payment",
  description,
  submitLabel = "Record Payment",
  onFillFull,
  showPartyName = false,
  showPaymentType = false,
  showReference = false,
  notesMultiline = false,
}: RecordPaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!saving) onOpenChange(v); }}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 mt-1">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label>Amount (₹) *</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={form.amount}
                onChange={e => onChange("amount", e.target.value)}
                placeholder="0.00"
                required
              />
              {onFillFull && (
                <Button type="button" variant="outline" onClick={onFillFull}>
                  Full
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Party Name */}
            {showPartyName && (
              <div className="space-y-1.5 col-span-2">
                <Label>Party Name</Label>
                <Input
                  value={form.party_name ?? ""}
                  onChange={e => onChange("party_name", e.target.value)}
                  placeholder="Customer or vendor name"
                />
              </div>
            )}

            {/* Payment Type */}
            {showPaymentType && (
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.payment_type ?? "received"}
                  onValueChange={v => onChange("payment_type", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label>Method</Label>
              <CreatableCombobox
                optionsKey="payment_method"
                value={form.payment_method}
                onChange={v => onChange("payment_method", v)}
                placeholder="Select method…"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.payment_date}
                onChange={e => onChange("payment_date", e.target.value)}
                required
              />
            </div>

            {/* Reference / UTR */}
            {showReference && (
              <div className="space-y-1.5 col-span-2">
                <Label>Reference</Label>
                <Input
                  value={form.reference ?? ""}
                  onChange={e => onChange("reference", e.target.value)}
                  placeholder="UTR / cheque no"
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            {notesMultiline ? (
              <Textarea
                value={form.notes}
                onChange={e => onChange("notes", e.target.value)}
                placeholder="Optional notes"
              />
            ) : (
              <Input
                value={form.notes}
                onChange={e => onChange("notes", e.target.value)}
                placeholder="Optional reference or notes"
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {saving ? "Saving…" : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
