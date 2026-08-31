import { cn } from "@/lib/utils";

interface LegendItem {
  label: string;
  colorClass: string;
}

interface InlineChartLegendProps {
  items: LegendItem[];
}

export function InlineChartLegend({ items }: InlineChartLegendProps) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block h-2 w-2 shrink-0 rounded-full",
              i.colorClass
            )}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
