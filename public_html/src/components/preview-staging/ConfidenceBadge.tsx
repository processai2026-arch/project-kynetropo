import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  score: number;
  label?: string;
  className?: string;
}

export function ConfidenceBadge({
  score,
  label = "confidence",
  className,
}: ConfidenceBadgeProps) {
  const clamped = Math.min(100, Math.max(0, score));

  return (
    <Badge
      variant="outline"
      className={cn(
        "bg-primary/10 text-primary border-primary/30",
        className
      )}
    >
      {Number(clamped).toFixed(0)}% {label}
    </Badge>
  );
}
