import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A table cell that carries two related facts on two lines.
 *
 * Operator name over operator code, area over taluk. These pairs were separate
 * columns, which made the table wide enough that Status and Actions fell off
 * the right on a laptop — and the second value in each pair was never the one
 * being scanned for, only the one being confirmed once the row was found. Set
 * under its partner in smaller, dimmer type it stays available without costing
 * a column.
 *
 * A missing second line collapses rather than leaving a gap, so rows with and
 * without one still line up.
 */
export function StackedCell({
  primary,
  secondary,
  className,
}: {
  primary: ReactNode;
  /** Rendered only when it has something to say. */
  secondary?: ReactNode;
  className?: string;
}) {
  const hasSecondary =
    secondary !== null && secondary !== undefined && secondary !== "" && secondary !== "—";

  return (
    <div className={cn("min-w-0 leading-tight", className)}>
      <div className="truncate font-medium text-card-foreground">{primary}</div>
      {hasSecondary && (
        <div className="truncate text-xs text-muted-foreground">{secondary}</div>
      )}
    </div>
  );
}

export default StackedCell;
