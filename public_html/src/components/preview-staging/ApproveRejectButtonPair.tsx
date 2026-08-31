import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ApproveRejectButtonPairProps {
  /** Called when the approve (check) button is clicked. */
  onApprove: () => void;
  /** Called when the reject (X) button is clicked. */
  onReject: () => void;
  /** Disables both buttons while an async operation is in flight. */
  pending?: boolean;
}

export function ApproveRejectButtonPair({
  onApprove,
  onReject,
  pending = false,
}: ApproveRejectButtonPairProps) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        size="icon"
        variant="ghost"
        title="Approve"
        disabled={pending}
        onClick={onApprove}
        className="hover:bg-emerald-50 hover:text-emerald-700"
      >
        <Check className="h-4 w-4 text-emerald-600" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        title="Reject"
        disabled={pending}
        onClick={onReject}
        className="hover:bg-red-50 hover:text-red-700"
      >
        <X className="h-4 w-4 text-red-600" />
      </Button>
    </div>
  );
}

export default ApproveRejectButtonPair;
