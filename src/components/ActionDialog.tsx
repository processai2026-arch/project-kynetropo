import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/errors";

/**
 * A confirm-a-command dialog (from chennis-raymondshop). It blocks closing
 * while the request runs and shows the server's refusal inline, so a failed
 * delete leaves the dialog open with the reason. Optional reason box.
 */
export function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  reason,
  note,
  children,
  onConfirm,
  successMessage,
  disabled,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  /** Show a required reason box with this label. */
  reason?: string;
  /** Show an optional note box with this label (ignored when `reason` is set). */
  note?: string;
  children?: ReactNode;
  onConfirm: (ctx: { reason: string }) => Promise<unknown>;
  successMessage?: string;
  disabled?: boolean;
  wide?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) {
      setError(null);
      setText("");
    }
  }, [open]);

  const run = async () => {
    if (reason && !text.trim()) {
      setError(`${reason} is required`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ reason: text.trim() });
      if (successMessage) toast.success(successMessage);
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className={wide ? "max-w-2xl" : "max-w-md"} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription asChild><div>{description}</div></DialogDescription>}
        </DialogHeader>
        {children}
        {(reason || note) && (
          <div className="space-y-1.5">
            <Label htmlFor="action-reason">
              {reason ?? note}{!reason && <span className="font-normal text-muted-foreground"> (optional)</span>}
            </Label>
            <Textarea id="action-reason" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={run} disabled={busy || disabled}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ActionDialog;
