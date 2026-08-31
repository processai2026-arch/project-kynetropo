import { cn } from "@/lib/utils";

interface DueDateWithTimeProps {
  /** Formatted date string to display, e.g. "Jul 31, 2026" */
  date: string;
  /** Optional time string rendered inline in muted text, e.g. "3:00 PM" */
  time?: string;
  /** When true, switches date text to destructive color to signal an overdue item */
  isOverdue?: boolean;
}

export function DueDateWithTime({ date, time, isOverdue = false }: DueDateWithTimeProps) {
  return (
    <span
      className={cn(
        "text-sm",
        isOverdue ? "text-destructive font-medium" : "text-card-foreground"
      )}
    >
      {date}
      {time && (
        <span className="ml-1 text-xs text-muted-foreground">{time}</span>
      )}
    </span>
  );
}

export default DueDateWithTime;
