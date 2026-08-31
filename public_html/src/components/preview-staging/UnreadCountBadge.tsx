import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface UnreadCountBadgeProps {
  count: number;
  label?: string;
}

export function UnreadCountBadge({ count, label = "unread" }: UnreadCountBadgeProps) {
  if (count <= 0) return null;

  return (
    <Badge className={cn("bg-primary text-primary-foreground border-0")}>
      {count} {label}
    </Badge>
  );
}
