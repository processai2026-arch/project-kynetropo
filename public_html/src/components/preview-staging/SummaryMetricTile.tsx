import { cn } from "@/lib/utils";

interface SummaryMetricTileProps {
  label: string;
  value: string;
  className?: string;
}

export function SummaryMetricTile({ label, value, className }: SummaryMetricTileProps) {
  return (
    <div className={cn("bg-muted/30 rounded-lg p-4", className)}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
