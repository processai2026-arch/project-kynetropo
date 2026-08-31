import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BalanceDuePanelProps {
  balanceDue: number;
  amountPaid: number;
  total: string;
  actions: ReactNode;
}

function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function BalanceDuePanel({
  balanceDue,
  amountPaid,
  total,
  actions,
}: BalanceDuePanelProps) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase text-muted-foreground font-semibold">
          Balance Due
        </p>
        <p
          className={cn(
            "text-xl font-bold",
            balanceDue > 0 ? "text-red-600" : "text-emerald-600"
          )}
        >
          {inr(balanceDue)}
        </p>
        <p className="text-xs text-muted-foreground">
          Paid {inr(amountPaid)} of {total}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">{actions}</div>
    </div>
  );
}
