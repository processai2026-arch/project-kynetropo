import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusTransitionArrowProps {
  /** The status value being transitioned FROM */
  from: string;
  /** The status value being transitioned TO */
  to: string;
  /** Map of status value to Tailwind badge class string (must include border color) */
  statusStyles: Record<string, string>;
  /** Optional entity label shown before the badges, e.g. "Lead" or "Booking" */
  label?: string;
}

const FALLBACK = "bg-muted text-muted-foreground";

function formatStatus(value: string): string {
  return value.replace(/_/g, " ");
}

export function StatusTransitionArrow({
  from,
  to,
  statusStyles,
  label,
}: StatusTransitionArrowProps) {
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      {label && (
        <span className="text-xs text-muted-foreground">{label}:</span>
      )}
      <Badge
        className={cn(
          "border text-xs capitalize",
          statusStyles[from] ?? FALLBACK
        )}
      >
        {formatStatus(from)}
      </Badge>
      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
      <Badge
        className={cn(
          "border text-xs capitalize",
          statusStyles[to] ?? FALLBACK
        )}
      >
        {formatStatus(to)}
      </Badge>
    </span>
  );
}

export default StatusTransitionArrow;
