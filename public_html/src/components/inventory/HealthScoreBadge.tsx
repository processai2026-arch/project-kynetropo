import { cn } from "@/lib/utils";

export function HealthScoreBadge({
  score,
  showValue = true,
}: {
  score: number;
  showValue?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, Number(score ?? 0)));
  const color =
    pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : pct >= 25 ? "bg-orange-500" : "bg-red-500";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block h-2 w-2 rounded-full", color)} />
      {showValue && (
        <span className="text-xs font-medium text-card-foreground">{Math.round(pct)}%</span>
      )}
    </span>
  );
}
