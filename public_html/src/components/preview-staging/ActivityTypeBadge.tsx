import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ActivityType = "call" | "meeting" | "task" | "note";

interface ActivityTypeBadgeProps {
  type: ActivityType;
}

export function ActivityTypeBadge({ type }: ActivityTypeBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", type === "call" && "inline-flex items-center gap-1")}
    >
      {type === "call" && <Phone className="h-3 w-3 mr-1" />}
      {type}
    </Badge>
  );
}
