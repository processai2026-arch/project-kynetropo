import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarLeaveStatus = "submitted" | "approved" | "rejected";

export interface CalendarEventItemProps {
  /** Full display name of the employee on leave. */
  employeeName: string;
  /** Human-readable leave type (e.g. "Annual Leave", "Sick Leave"). */
  leaveTypeName: string;
  /** ISO date string YYYY-MM-DD — start of the leave window. */
  startDate: string;
  /** ISO date string YYYY-MM-DD — end of the leave window. */
  endDate: string;
  /** Approval state of the leave request. */
  status: CalendarLeaveStatus;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert "YYYY-MM-DD" → "01 Jan 2026" without importing date-fns. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<CalendarLeaveStatus, string> = {
  submitted: "border-amber-300 bg-amber-50 text-amber-700",
  approved:  "border-emerald-300 bg-emerald-50 text-emerald-700",
  rejected:  "border-red-300 bg-red-50 text-red-700",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarEventItem({
  employeeName,
  leaveTypeName,
  startDate,
  endDate,
  status,
}: CalendarEventItemProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      {/* Left: name + sub-line */}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-card-foreground">
          {employeeName}
        </div>
        <div className="mt-0.5 text-sm text-muted-foreground">
          {leaveTypeName}&nbsp;·&nbsp;{formatDate(startDate)}&nbsp;–&nbsp;{formatDate(endDate)}
        </div>
      </div>

      {/* Right: status badge */}
      <Badge
        variant="outline"
        className={cn("shrink-0 capitalize", STATUS_STYLES[status])}
      >
        {status}
      </Badge>
    </div>
  );
}

export default CalendarEventItem;
