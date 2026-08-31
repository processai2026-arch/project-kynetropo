import type { FC } from "react";

interface DateTimeCellProps {
  /** Date string to display — required. */
  date: string;
  /** Optional time string shown inline, smaller and muted. */
  time?: string;
}

export const DateTimeCell: FC<DateTimeCellProps> = ({ date, time }) => (
  <td className="py-3 px-4 text-card-foreground">
    {date}
    {time && (
      <span className="ml-1 text-xs text-muted-foreground">{time}</span>
    )}
  </td>
);

export default DateTimeCell;
