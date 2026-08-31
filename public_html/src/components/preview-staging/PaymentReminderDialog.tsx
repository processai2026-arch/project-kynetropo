import { Bell, Loader2 } from "lucide-react";
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

export interface ReminderForm {
  email: string;
  subject: string;
  message: string;
}

export interface PaymentReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | number;
  reminderForm: ReminderForm;
  onFormChange: (form: ReminderForm) => void;
  onSend: () => void;
  isSaving: boolean;
}

export function PaymentReminderDialog({
  open,
  onOpenChange,
  invoiceId,
  reminderForm,
  onFormChange,
  onSend,
  isSaving,
}: PaymentReminderDialogProps) {
  const set = (key: keyof ReminderForm, value: string) =>
    onFormChange({ ...reminderForm, [key]: value });

  const canSend = !isSaving && reminderForm.email.trim().length > 0;

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
            <Bell className="h-5 w-5" />
            Payment Reminder
          </DialogTitle>
          <DialogDescription>
            Email the overdue balance for invoice{" "}
            <span className="font-medium text-foreground">{invoiceId}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label
              htmlFor="reminder-email"
              className="text-xs text-muted-foreground"
            >
              Recipient email
            </Label>
            <Input
              id="reminder-email"
              type="email"
              placeholder="client@example.com"
              value={reminderForm.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="reminder-subject"
              className="text-xs text-muted-foreground"
            >
              Subject
            </Label>
            <Input
              id="reminder-subject"
              placeholder="Payment reminder for Invoice #..."
              value={reminderForm.subject}
              onChange={(e) => set("subject", e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="reminder-message"
              className="text-xs text-muted-foreground"
            >
              Additional message
            </Label>
            <Textarea
              id="reminder-message"
              rows={4}
              placeholder="Optional note to include in the email body..."
              value={reminderForm.message}
              onChange={(e) => set("message", e.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={onSend} disabled={!canSend}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Send Reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentReminderDialog;
