import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/currency";

export interface CompactPaymentRowProps {
  /** e.g. "bank_transfer", "cheque", "cash" — underscores are replaced with spaces */
  paymentType: string;
  /** Reference or receipt code */
  code: string;
  /** When true, renders a "Loan" badge after the code */
  isLoan?: boolean;
  /** Raw numeric amount — formatted via inr() */
  amount: number | null | undefined;
}

export function CompactPaymentRow({
  paymentType,
  code,
  isLoan = false,
  amount,
}: CompactPaymentRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs rounded-md border border-border bg-card px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="text-card-foreground font-medium capitalize truncate">
          {paymentType.replace(/_/g, " ")}
        </span>
        <span className="text-muted-foreground shrink-0">·</span>
        <span className="text-muted-foreground truncate">{code}</span>
        {isLoan && (
          <Badge
            className={cn(
              "border capitalize shrink-0",
              "bg-blue-50 text-blue-600 border-blue-200"
            )}
          >
            Loan
          </Badge>
        )}
      </span>
      <span className="text-card-foreground font-medium shrink-0 tabular-nums">
        {inr(amount)}
      </span>
    </div>
  );
}

export default CompactPaymentRow;
