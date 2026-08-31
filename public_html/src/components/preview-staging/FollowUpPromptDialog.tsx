import { CalendarClock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface FollowUpPromptDialogProps {
  /** Controls dialog visibility. */
  open: boolean;
  /** Heading shown in the dialog title bar. */
  title: string;
  /** Confirmation copy displayed above the follow-up question. */
  successMessage: string;
  /** Called when the user clicks "Yes, Schedule". */
  onSchedule: () => void;
  /** Called when the user clicks "Skip". */
  onSkip: () => void;
}

/**
 * Blocking post-save dialog that asks the user whether to schedule a follow-up.
 * Interaction outside the dialog is intentionally suppressed — the user must
 * choose one of the two actions before continuing.
 */
export function FollowUpPromptDialog({
  open,
  title,
  successMessage,
  onSchedule,
  onSkip,
}: FollowUpPromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-card-foreground">{successMessage}</p>
          <p className="text-sm text-muted-foreground">
            Would you like to schedule a follow-up?
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={onSchedule}>
              <CalendarClock className="h-4 w-4 mr-2" />
              Yes, Schedule
            </Button>
            <Button variant="outline" className="flex-1" onClick={onSkip}>
              Skip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FollowUpPromptDialog;
