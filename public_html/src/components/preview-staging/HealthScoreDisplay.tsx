import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface HealthScoreDisplayProps {
  score: number | null;
  segmentLabel?: string | null;
  segment?: string | null;
}

function healthScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-500";
  return "text-destructive";
}

function segmentBadgeClass(segment: string | null | undefined): string {
  if (!segment) return "";
  switch (segment.toLowerCase()) {
    case "champion":
    case "loyal":
    case "high":
      return "border-emerald-200 text-emerald-700 bg-emerald-50";
    case "at_risk":
    case "at-risk":
    case "medium":
      return "border-amber-200 text-amber-600 bg-amber-50";
    case "lost":
    case "churned":
    case "low":
      return "border-red-200 text-red-600 bg-red-50";
    default:
      return "border-border text-muted-foreground";
  }
}

export function HealthScoreDisplay({
  score,
  segmentLabel = null,
  segment = null,
}: HealthScoreDisplayProps) {
  return (
    <div className="flex flex-col items-start">
      <p className={cn("text-3xl font-bold", healthScoreColor(score))}>
        {score !== null ? score.toFixed(0) : "—"}
        <span className="text-sm text-muted-foreground font-normal">/100</span>
      </p>
      {segmentLabel && (
        <Badge
          variant="outline"
          className={cn("mt-1", segmentBadgeClass(segment))}
        >
          {segmentLabel}
        </Badge>
      )}
    </div>
  );
}
