import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeaveEntryStatus = "submitted" | "approved" | "rejected";

/**
 * Minimal shape required for each entry row.
 * Matches the calendar-relevant subset of LeaveRequest from src/lib/api/leave.ts.
 */
export interface CalendarEntry {
  /** Unique identifier — used as React key */
  id: number;
  employee_name?: string | null;
  leave_type_name?: string | null;
  /** ISO date string "YYYY-MM-DD" */
  start_date: string;
  /** ISO date string "YYYY-MM-DD" */
  end_date: string;
  status: LeaveEntryStatus;
}

export interface CalendarDayPanelProps {
  /** The currently selected calendar day */
  selectedDay: Date;
  /** Leave entries that span or fall on selectedDay */
  entries: CalendarEntry[];
}

// ─── Date helpers (no date-fns dependency) ───────────────────────────────────

/** Parse an ISO date string as local midnight to avoid UTC shift on display. */
const parseLocalDate = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Formats a Date as "Thursday, 31 July 2025"
 * (equivalent to date-fns `format(date, "EEEE, dd MMMM yyyy")`)
 */
const fmtHeading = (date: Date): string =>
  date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

/**
 * Formats an ISO date string as "31 Jul 2025"
 * (equivalent to date-fns `format(parseISO(iso), "dd MMM yyyy")`)
 */
const fmtShort = (iso: string): string =>
  parseLocalDate(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

// ─── Status badge styles ──────────────────────────────────────────────────────

const statusStyles: Record<LeaveEntryStatus, string> = {
  submitted: "border-amber-300 bg-amber-50 text-amber-700",
  approved:  "border-emerald-300 bg-emerald-50 text-emerald-700",
  rejected:  "border-red-300 bg-red-50 text-red-700",
};

// ─── CalendarEventItem (internal) ─────────────────────────────────────────────

const CalendarEventItem: FC<CalendarEntry> = ({
  employee_name,
  leave_type_name,
  start_date,
  end_date,
  status,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
    <div>
      <div className="text-sm font-medium text-card-foreground">
        {employee_name ?? "—"}
      </div>
      <div className="text-xs text-muted-foreground">
        {leave_type_name ?? "Leave"}
        {" · "}
        {fmtShort(start_date)}
        {start_date !== end_date && ` – ${fmtShort(end_date)}`}
      </div>
    </div>
    <Badge
      variant="outline"
      className={cn("capitalize", statusStyles[status])}
    >
      {status}
    </Badge>
  </div>
);

// ─── CalendarDayPanel ─────────────────────────────────────────────────────────

export function CalendarDayPanel({ selectedDay, entries }: CalendarDayPanelProps) {
  return (
    <div className="rounded-md border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-card-foreground">
          {fmtHeading(selectedDay)}
        </h2>
        <p className="text-xs text-muted-foreground">
          {entries.length} leave {entries.length === 1 ? "entry" : "entries"}
        </p>
      </div>
      <div className="divide-y">
        {entries.map((entry) => (
          <CalendarEventItem key={entry.id} {...entry} />
        ))}
        {entries.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No leave recorded for this date
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarDayPanel;
