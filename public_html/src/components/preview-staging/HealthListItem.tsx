import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface HealthListItemProps {
  name: string;
  subtitle: string;
  score: number;
  segment: string | null;
}

function segmentBadgeClass(segment: string | null): string {
  switch (segment) {
    case "champions":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "loyal":
      return "border-blue-300 bg-blue-50 text-blue-700";
    case "at_risk":
      return "border-amber-300 bg-amber-50 text-amber-700";
    case "lost":
      return "border-red-300 bg-red-50 text-red-700";
    case "new":
      return "border-sky-300 bg-sky-50 text-sky-700";
    case "promising":
      return "border-teal-300 bg-teal-50 text-teal-700";
    case "hibernating":
      return "border-gray-300 bg-gray-100 text-gray-500";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function HealthListItem({
  name,
  subtitle,
  score,
  segment,
}: HealthListItemProps) {
  return (
    <div className="flex items-center justify-between p-2 border rounded-md text-sm">
      <div>
        <p className="font-medium text-card-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <Badge
        variant="outline"
        className={cn(segmentBadgeClass(segment))}
      >
        {score.toFixed(0)}
      </Badge>
    </div>
  );
}
