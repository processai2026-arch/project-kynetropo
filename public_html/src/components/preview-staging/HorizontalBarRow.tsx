import { cn } from "@/lib/utils";

interface HorizontalBarRowProps {
  label: string;
  valueLabel: string;
  percent: number;
  barClassName?: string;
}

export function HorizontalBarRow({
  label,
  valueLabel,
  percent,
  barClassName = "bg-primary",
}: HorizontalBarRowProps) {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-card-foreground capitalize w-20 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
        <div
          className={cn("h-full rounded-md transition-all", barClassName)}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      <span className="text-xs font-mono text-card-foreground w-24 text-right shrink-0">
        {valueLabel}
      </span>
    </div>
  );
}
