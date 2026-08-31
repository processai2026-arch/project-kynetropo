import { Printer, MessageCircle, Send, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ActionButtonsCardProps {
  /** Heading text rendered at the top of the card */
  title: string;
  /** Current entity status — controls which action buttons are visible */
  status: string;
  /** True while an async action is in-flight; disables all buttons and shows a spinner on the active one */
  acting?: boolean;
  /** Called when the user clicks Download PDF */
  onDownload: () => void;
  /** Called when the user clicks Share via WhatsApp */
  onShare: () => void;
  /** Called when the user clicks Mark as Sent (only rendered when status === 'draft') */
  onMarkSent?: () => void;
  /** Called when the user clicks Accept (only rendered when status === 'sent') */
  onAccept?: () => void;
  /** Called when the user clicks Reject (only rendered when status === 'sent') */
  onReject?: () => void;
}

export function ActionButtonsCard({
  title,
  status,
  acting = false,
  onDownload,
  onShare,
  onMarkSent,
  onAccept,
  onReject,
}: ActionButtonsCardProps) {
  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 space-y-3">
      <h2 className="text-base font-semibold text-card-foreground">{title}</h2>

      <Button className="w-full" variant="outline" onClick={onDownload} disabled={acting}>
        <Printer className="h-4 w-4 mr-2" />
        Download PDF
      </Button>

      <Button className="w-full" variant="outline" onClick={onShare} disabled={acting}>
        <MessageCircle className="h-4 w-4 mr-2 text-emerald-600" />
        Share via WhatsApp
      </Button>

      {status === 'draft' && onMarkSent && (
        <Button className="w-full" disabled={acting} onClick={onMarkSent}>
          {acting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Mark as Sent
        </Button>
      )}

      {status === 'sent' && (
        <>
          {onAccept && (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={acting}
              onClick={onAccept}
            >
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Accept
            </Button>
          )}
          {onReject && (
            <Button
              className="w-full"
              variant="destructive"
              disabled={acting}
              onClick={onReject}
            >
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export default ActionButtonsCard;
