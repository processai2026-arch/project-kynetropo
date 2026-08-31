import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CalendarDayEntryRowProps {
  primaryLabel: string;
  secondaryLabel: string;
  statusText: string;
  statusClass?: string;
}

export function CalendarDayEntryRow({
  primaryLabel,
  secondaryLabel,
  statusText,
  statusClass = "",
}: CalendarDayEntryRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      <div>
        <div className="font-medium text-card-foreground">{primaryLabel}</div>
        <div className="text-sm text-muted-foreground">{secondaryLabel}</div>
      </div>
      <Badge
        variant="outline"
        className={cn("border capitalize", statusClass)}
      >
        {statusText}
      </Badge>
    </div>
  );
}
