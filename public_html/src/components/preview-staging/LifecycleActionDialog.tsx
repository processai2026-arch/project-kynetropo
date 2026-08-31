import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LifecycleActionDialogProps {
  open: boolean;
  action: "cancel" | "resume" | "change_plan";
  planName?: string;
  effectiveDate: string;
  reason: string;
  busy: boolean;
  onEffectiveDateChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

function resolveTitle(
  action: LifecycleActionDialogProps["action"],
  planName: string | undefined
): string {
  if (action === "cancel") return "Cancel subscription";
  if (action === "resume") return "Resume subscription";
  return `Change to ${planName ?? "new plan"}`;
}

function resolveReasonLabel(
  action: LifecycleActionDialogProps["action"]
): string {
  if (action === "cancel") return "Reason for cancellation";
  if (action === "resume") return "Reason for resuming";
  return "Reason for change";
}

function resolveReasonPlaceholder(
  action: LifecycleActionDialogProps["action"]
): string {
  if (action === "cancel") return "Why are you cancelling this subscription?";
  if (action === "resume") return "Why are you resuming this subscription?";
  return "Why are you changing the plan?";
}

export function LifecycleActionDialog({
  open,
  action,
  planName,
  effectiveDate,
  reason,
  busy,
  onEffectiveDateChange,
  onReasonChange,
  onClose,
  onConfirm,
}: LifecycleActionDialogProps) {
  const isCancel = action === "cancel";
  const canConfirm = reason.trim().length > 0 && effectiveDate.length > 0 && !busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{resolveTitle(action, planName)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lifecycle-effective-date">Effective date</Label>
            <Input
              id="lifecycle-effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => onEffectiveDateChange(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lifecycle-reason">
              {resolveReasonLabel(action)}
            </Label>
            <Textarea
              id="lifecycle-reason"
              placeholder={resolveReasonPlaceholder(action)}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              disabled={busy}
              rows={3}
              className={cn(
                isCancel && "focus-visible:ring-destructive/50"
              )}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Keep current
          </Button>
          <Button
            variant={isCancel ? "destructive" : "default"}
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving…
              </>
            ) : isCancel ? (
              "Confirm cancellation"
            ) : (
              "Save change"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
