import { cn } from "@/lib/utils";

// Formats an ISO date string to a human-readable locale string (e.g. "15 Aug 2025").
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface OverdueDateCellProps {
  /** ISO date string (YYYY-MM-DD or full ISO-8601). */
  dueDate: string;
  /**
   * True when the task is past its due date AND is neither completed
   * nor cancelled. Computing this flag is the caller's responsibility
   * so the component stays pure and reusable.
   */
  isOverdue: boolean;
}

/**
 * OverdueDateCell
 *
 * A <td> table cell that renders a formatted due date.
 * When `isOverdue` is true the text turns destructive red, gains
 * semibold weight, and appends an "(Overdue)" suffix in a smaller
 * caption size — mirroring the exact visual treatment used in Tasks.tsx.
 */
export function OverdueDateCell({ dueDate, isOverdue }: OverdueDateCellProps) {
  return (
    <td
      className={cn(
        "py-3 px-4 text-sm",
        isOverdue ? "text-destructive font-semibold" : "text-card-foreground",
      )}
    >
      {formatDate(dueDate)}
      {isOverdue && (
        <span className="ml-1 text-xs">(Overdue)</span>
      )}
    </td>
  );
}

export default OverdueDateCell;
