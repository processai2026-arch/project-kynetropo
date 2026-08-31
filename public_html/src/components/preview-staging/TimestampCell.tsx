import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimestampCellProps {
  value: string;
  formatFn?: (v: string) => string;
  className?: string;
}

function defaultFormat(v: string): string {
  try {
    return new Date(v).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
}

export function TimestampCell({ value, formatFn, className }: TimestampCellProps) {
  const display = (formatFn ?? defaultFormat)(value);

  return (
    <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
      <Clock className="w-3 h-3 shrink-0" />
      <span>{display}</span>
    </div>
  );
}
