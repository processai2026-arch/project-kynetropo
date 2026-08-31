import React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PayslipFinancialRow — a single label + amount flex row inside a section
// ---------------------------------------------------------------------------

export interface PayslipFinancialRowProps {
  /** Left-side label, e.g. "Earned Salary" */
  label: string;
  /** Right-side formatted amount, e.g. "₹12,500" */
  amount: string;
  /** Render both sides in font-medium — use for totals / sub-totals */
  bold?: boolean;
  className?: string;
}

export function PayslipFinancialRow({
  label,
  amount,
  bold = false,
  className,
}: PayslipFinancialRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        bold ? "font-medium text-foreground" : "text-sm",
        className,
      )}
    >
      <span className={cn(bold ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      <span className="text-foreground tabular-nums">{amount}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PayslipFinancialSection — bordered, top-padded wrapper for one category
// ---------------------------------------------------------------------------

export interface PayslipFinancialSectionProps {
  /**
   * Optional section heading rendered above the rows.
   * Examples: "Earnings", "Deductions", "Net Summary"
   */
  title?: string;
  /** One or more <PayslipFinancialRow> elements (or any node) */
  children: React.ReactNode;
  className?: string;
}

export function PayslipFinancialSection({
  title,
  children,
  className,
}: PayslipFinancialSectionProps) {
  return (
    <div className={cn("border-t border-border pt-3 space-y-1.5", className)}>
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

export default PayslipFinancialSection;
