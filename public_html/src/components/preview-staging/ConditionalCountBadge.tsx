import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConditionalCountBadgeProps {
  count: number;
}

export function ConditionalCountBadge({ count }: ConditionalCountBadgeProps) {
  if (count > 0) {
    return (
      <Badge className={cn("border", "bg-red-50 text-red-600 border-red-200")}>
        {count}
      </Badge>
    );
  }

  return <span className="text-muted-foreground">—</span>;
}
