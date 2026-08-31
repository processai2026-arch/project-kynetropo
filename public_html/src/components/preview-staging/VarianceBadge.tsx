import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VarianceBadgeProps {
  variance: number;
  positiveLabel?: string;
  negativeLabel?: string;
}

export function VarianceBadge({
  variance,
  positiveLabel = "On Track",
  negativeLabel = "Over Budget",
}: VarianceBadgeProps) {
  const isPositive = variance >= 0;

  return (
    <Badge
      variant="outline"
      className={cn(
        isPositive
          ? "text-emerald-600 border-emerald-200"
          : "text-red-600 border-red-200"
      )}
    >
      {isPositive ? positiveLabel : negativeLabel}
    </Badge>
  );
}
