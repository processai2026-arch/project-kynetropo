import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ScrollableX } from "@/components/ui/scrollable-x";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterEmployeeInfo {
  /** Display name */
  name: string;
  /** Employee ID / HR key shown as a subdued caption */
  employeeKey: string;
  /** Department — appended to the caption row when provided */
  department?: string;
  /** Designation — appended to the caption row when provided */
  designation?: string;
}

export interface RegisterEmployeeBlockProps {
  /** Core employee identity rendered in the card header */
  employee: RegisterEmployeeInfo;
  /**
   * Badge nodes rendered on the right side of the header.
   * Typically a set of <Badge> elements summarising totals.
   */
  summaryBadges: ReactNode;
  /**
   * Primary data table rendered inside a horizontal scroll container.
   * Pass the <table> element directly — this component supplies the
   * <ScrollableX> wrapper.
   */
  dataTable: ReactNode;
  /**
   * Content rendered inside the collapsible drill-down disclosure.
   * Wrap in <ScrollableX> yourself if the inner table is wide.
   */
  drillTable: ReactNode;
  /** Label shown on the disclosure toggle. Defaults to "Details". */
  drillLabel?: string;
  /**
   * Count shown in parentheses after the disclosure label
   * (e.g. the number of leave requests for this employee).
   */
  drillCount?: number;
  /** Additional className applied to the outermost wrapper div. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegisterEmployeeBlock({
  employee,
  summaryBadges,
  dataTable,
  drillTable,
  drillLabel = "Details",
  drillCount,
  className,
}: RegisterEmployeeBlockProps) {
  const subtitle = [employee.employeeKey, employee.department, employee.designation]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("overflow-hidden rounded-md border bg-card shadow-sm", className)}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
        <div>
          <div className="font-semibold text-card-foreground">{employee.name}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
        {summaryBadges && (
          <div className="flex flex-wrap gap-2 text-xs">{summaryBadges}</div>
        )}
      </div>

      {/* ── Main data table (horizontally scrollable) ──────────────────── */}
      <ScrollableX>{dataTable}</ScrollableX>

      {/* ── Drill-down disclosure ───────────────────────────────────────── */}
      <details className="border-t">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-primary">
          {drillLabel}
          {drillCount !== undefined && ` (${drillCount})`}
        </summary>
        <div className="border-t">{drillTable}</div>
      </details>
    </div>
  );
}

export default RegisterEmployeeBlock;
