import { cn } from "@/lib/utils";
import { inr } from "@/lib/currency";

export interface PLRowProps {
  /** Row label displayed on the left */
  label: string;
  /** Numeric value to display on the right */
  value: number;
  /** When true renders the row as a total line: top border, semibold text */
  bold?: boolean;
  /** When true the value is treated as a cost/deduction — positive numbers are shown with a minus sign and rendered in destructive color */
  negative?: boolean;
  /** When true the row is not rendered at all */
  hide?: boolean;
}

/**
 * PLRow — a single labeled value row for P&L / ledger sections.
 *
 * Handles three display modes automatically:
 *   - Regular income row    (bold=false, negative=false)
 *   - Cost / deduction row  (negative=true) — adds leading "−" and uses destructive color
 *   - Subtotal / total row  (bold=true)     — adds top border and semibold weight; color
 *                                             switches to destructive only when value is negative
 */
export function PLRow({ label, value, bold = false, negative = false, hide = false }: PLRowProps) {
  if (hide) return null;

  const valueClass = bold
    ? value >= 0
      ? "text-card-foreground"
      : "text-destructive"
    : negative
      ? "text-destructive"
      : "text-card-foreground";

  const displayValue = negative && value > 0 ? `−${inr(value)}` : inr(value);

  return (
    <div
      className={cn(
        "flex items-center justify-between py-2",
        bold && "border-t mt-1"
      )}
    >
      <span
        className={cn(
          "text-sm",
          bold ? "font-semibold text-card-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          valueClass
        )}
      >
        {displayValue}
      </span>
    </div>
  );
}

export default PLRow;
