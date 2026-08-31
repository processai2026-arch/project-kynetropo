import { Bell, CreditCard, FileMinus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/currency";

export interface BalanceDueCardProps {
  /** Remaining unpaid amount */
  balanceDue: number;
  /** Amount already paid */
  amountPaid: number;
  /** Full invoice total (numeric, for progress context) */
  total: number;
  /** Called when the user clicks "Record Payment" */
  onRecordPayment: () => void;
  /** Called when the user clicks "Send Reminder" */
  onSendReminder: () => void;
  /** Called when the user clicks "Issue Credit Note" */
  onIssueCreditNote: () => void;
  /** Called when the user clicks "Generate IRN" — omit to hide the button */
  onGenerateIRN?: () => void;
  className?: string;
}

export function BalanceDueCard({
  balanceDue,
  amountPaid,
  total,
  onRecordPayment,
  onSendReminder,
  onIssueCreditNote,
  onGenerateIRN,
  className,
}: BalanceDueCardProps) {
  const fullyPaid = balanceDue <= 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-muted/30 p-4 flex flex-wrap items-center justify-between gap-4",
        className
      )}
    >
      {/* Balance summary */}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Balance Due
        </p>
        <p
          className={cn(
            "text-2xl font-bold leading-tight mt-0.5",
            fullyPaid ? "text-emerald-600" : "text-card-foreground"
          )}
        >
          {fullyPaid ? "Paid in Full" : inr(balanceDue)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Paid {inr(amountPaid)} of {inr(total)}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onSendReminder}
          disabled={fullyPaid}
        >
          <Bell className="h-4 w-4" />
          Send Reminder
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onIssueCreditNote}
        >
          <FileMinus className="h-4 w-4" />
          Issue Credit Note
        </Button>

        {onGenerateIRN && (
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerateIRN}
          >
            <Receipt className="h-4 w-4" />
            Generate IRN
          </Button>
        )}

        <Button
          size="sm"
          onClick={onRecordPayment}
          disabled={fullyPaid}
        >
          <CreditCard className="h-4 w-4" />
          Record Payment
        </Button>
      </div>
    </div>
  );
}

export default BalanceDueCard;
