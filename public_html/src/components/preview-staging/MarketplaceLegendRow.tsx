import { cn } from "@/lib/utils";

interface MarketplaceLegendRowProps {
  label: string;
  color: string;
  formattedValue: string;
  className?: string;
}

export function MarketplaceLegendRow({
  label,
  color,
  formattedValue,
  className,
}: MarketplaceLegendRowProps) {
  return (
    <div className={cn("flex items-center justify-between text-xs", className)}>
      <span className="flex items-center gap-2 text-muted-foreground capitalize">
        <span
          className="w-2 h-2 rounded-full inline-block shrink-0"
          style={{ background: color }}
        />
        {label}
      </span>
      <span className="font-mono text-card-foreground font-medium">{formattedValue}</span>
    </div>
  );
}
