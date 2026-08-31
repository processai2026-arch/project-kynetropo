import { cn } from "@/lib/utils";

interface AttendancePctBadgeProps {
  pct: number;
}

export function AttendancePctBadge({ pct }: AttendancePctBadgeProps) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-1 rounded-full font-medium",
        pct >= 90
          ? "bg-primary/10 text-primary"
          : pct >= 75
          ? "bg-amber-100 text-amber-700"
          : "bg-destructive/10 text-destructive"
      )}
    >
      {pct}%
    </span>
  );
}
