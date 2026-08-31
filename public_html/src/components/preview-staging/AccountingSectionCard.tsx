import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AccountingSectionCardProps {
  heading: string;
  children: ReactNode;
  totalLabel?: string;
  totalValue: number;
  className?: string;
}

function fmtAmount(n: number): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AccountingSectionCard({
  heading,
  children,
  totalLabel = "Total",
  totalValue,
  className,
}: AccountingSectionCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border shadow-sm p-5", className)}>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {heading}
      </h2>
      <div className="space-y-0 text-sm">{children}</div>
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{totalLabel}</span>
        <span className="text-sm font-bold text-foreground tabular-nums">
          {fmtAmount(totalValue)}
        </span>
      </div>
    </div>
  );
}
