import type { ElementType } from "react";
import type { LucideProps } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface IconBadgeProps {
  label: string;
  icon?: ElementType<LucideProps>;
  badgeClassName?: string;
}

export function IconBadge({ label, icon: Icon, badgeClassName }: IconBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1", badgeClassName)}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </Badge>
  );
}
