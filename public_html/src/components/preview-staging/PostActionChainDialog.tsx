import { CheckCircle2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface PostActionChainDialogProps {
  /** Controls dialog visibility */
  open: boolean;
  /** Called when the dialog requests to open or close */
  onOpenChange: (open: boolean) => void;
  /** Title shown in the dialog header */
  completedTitle: string;
  /** Message shown inside the success banner */
  completedMessage: string;
  /** Body text prompting the user to take a next step */
  promptText: string;
  /** Label on the confirm / next-action button */
  nextActionLabel: string;
  /** Called when the user clicks the confirm button */
  onConfirm: () => void;
  /** Called when the user clicks Skip (or closes the dialog) */
  onSkip: () => void;
}

export function PostActionChainDialog({
  open,
  onOpenChange,
  completedTitle,
  completedMessage,
  promptText,
  nextActionLabel,
  onConfirm,
  onSkip,
}: PostActionChainDialogProps) {
  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); else onOpenChange(true); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-card-foreground">
            {completedTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Success banner */}
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-sm text-emerald-800 leading-snug">{completedMessage}</p>
          </div>

          {/* Next-step prompt */}
          <p className="text-sm text-card-foreground leading-relaxed">{promptText}</p>

          {/* Action row */}
          <div className="flex gap-3">
            <Button className="flex-1" onClick={handleConfirm}>
              {nextActionLabel}
            </Button>
            <Button variant="outline" onClick={handleSkip}>
              <X className="h-4 w-4 mr-1" />
              Skip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PostActionChainDialog;
