import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConditionalColorBadgeProps {
  value: string;
  dangerValue?: string;
  dangerClass?: string;
  safeClass?: string;
}

export function ConditionalColorBadge({
  value,
  dangerValue,
  dangerClass = "text-red-600",
  safeClass = "text-emerald-600",
}: ConditionalColorBadgeProps) {
  const isDanger = dangerValue !== undefined && value === dangerValue;

  return (
    <Badge
      variant="outline"
      className={cn(isDanger ? dangerClass : safeClass)}
    >
      {value}
    </Badge>
  );
}
