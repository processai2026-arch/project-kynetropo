import { cn } from "@/lib/utils";

interface StockLevelIndicatorProps {
  /** Current stock level */
  current: number;
  /** Reference (capacity) to compute the fill percentage against */
  reference: number;
  /** Whether to show a text label with the percentage */
  showLabel?: boolean;
}

export function StockLevelIndicator({
  current,
  reference,
  showLabel = true,
}: StockLevelIndicatorProps) {
  const pct = reference > 0 ? Math.min(100, (current / reference) * 100) : 0;
  const barColor =
    pct > 75 ? "bg-emerald-500" : pct > 40 ? "bg-amber-400" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
