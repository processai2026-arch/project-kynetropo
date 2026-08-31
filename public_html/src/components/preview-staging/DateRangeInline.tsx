import type { FC } from "react";
import { cn } from "@/lib/utils";

export interface DateRangeInlineProps {
  /** ISO date string (yyyy-MM-dd) for the start of the range */
  startDate: string;
  /** ISO date string (yyyy-MM-dd) for the end of the range */
  endDate: string;
  /** Optional extra Tailwind classes applied to the wrapping span */
  className?: string;
}

/**
 * Format an ISO date string as "DD Mon YYYY" (e.g. "31 Jul 2026").
 * Appending T00:00:00 forces local-time parsing so the date never
 * shifts by a timezone offset.
 */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Read-only inline date display.
 * - Shows a single date when startDate === endDate.
 * - Shows "DD Mon YYYY – DD Mon YYYY" when they differ.
 */
export const DateRangeInline: FC<DateRangeInlineProps> = ({
  startDate,
  endDate,
  className,
}) => {
  const isSingleDay = startDate === endDate;

  return (
    <span className={cn("text-sm text-card-foreground", className)}>
      {formatDate(startDate)}
      {!isSingleDay && (
        <> &ndash;&nbsp;{formatDate(endDate)}</>
      )}
    </span>
  );
};

export default DateRangeInline;
