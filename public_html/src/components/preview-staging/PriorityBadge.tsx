import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: string;
}

const priorityStyles: Record<string, string> = {
  low:    "bg-gray-100 text-gray-600 border-gray-200",
  normal: "bg-blue-50 text-blue-700 border-blue-200",
  high:   "bg-amber-50 text-amber-700 border-amber-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <Badge
      className={cn(
        "border capitalize",
        priorityStyles[priority] ?? "bg-muted text-muted-foreground"
      )}
    >
      {priority.replace(/_/g, " ")}
    </Badge>
  );
}

export default PriorityBadge;
