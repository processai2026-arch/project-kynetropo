import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

interface SystemResourceBadgeProps {
  isSystem: boolean;
  label?: string;
}

export function SystemResourceBadge({ isSystem, label = "System" }: SystemResourceBadgeProps) {
  if (!isSystem) return null;

  return (
    <Badge
      className={cn(
        "border bg-muted text-muted-foreground text-xs gap-1 select-none pointer-events-none"
      )}
    >
      <Lock className="h-3 w-3 shrink-0" />
      {label}
    </Badge>
  );
}
