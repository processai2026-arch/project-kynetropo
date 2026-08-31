import React from "react";
import { cn } from "@/lib/utils";

export interface PricingRow {
  label: string;
  value: string | React.ReactNode;
}

export interface PricingBreakdownCardProps {
  /** Section heading shown in the muted header strip */
  title: string;
  /** Ordered list of label/value pairs rendered as bordered rows */
  rows: PricingRow[];
  /** Label for the bold total footer row */
  totalLabel: string;
  /** Value for the bold total footer row */
  totalValue: string | React.ReactNode;
  /** Optional extra Tailwind classes on the outer wrapper */
  className?: string;
}

export function PricingBreakdownCard({
  title,
  rows,
  totalLabel,
  totalValue,
  className,
}: PricingBreakdownCardProps) {
  return (
    <div className={cn("border border-border rounded-xl overflow-hidden", className)}>
      {/* Header strip */}
      <div className="bg-muted/50 px-4 py-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
      </div>

      {/* Row list */}
      <div className="px-4 pt-3 pb-4 space-y-0 text-sm">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2 border-b border-border last:border-0"
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="text-card-foreground tabular-nums">{row.value}</span>
          </div>
        ))}

        {/* Total footer — double top border separates it from the rows */}
        <div className="flex items-center justify-between pt-3 mt-1 border-t-2 border-border">
          <span className="font-bold text-card-foreground">{totalLabel}</span>
          <span className="text-lg font-bold text-card-foreground tabular-nums">
            {totalValue}
          </span>
        </div>
      </div>
    </div>
  );
}

export default PricingBreakdownCard;
