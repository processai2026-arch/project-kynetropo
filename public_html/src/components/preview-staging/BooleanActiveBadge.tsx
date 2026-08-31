import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BooleanActiveBadgeProps {
  isActive: boolean;
  className?: string;
}

export function BooleanActiveBadge({ isActive, className }: BooleanActiveBadgeProps) {
  if (isActive) {
    return (
      <Badge
        className={cn(
          "border-transparent bg-emerald-500 text-white hover:bg-emerald-600",
          className
        )}
      >
        Active
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn("text-muted-foreground", className)}
    >
      Inactive
    </Badge>
  );
}
