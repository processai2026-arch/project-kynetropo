import { cn } from "@/lib/utils";

export interface ColorLegendItem {
  label: string;
  swatchClass: string;
}

export interface ColorLegendProps {
  items: ColorLegendItem[];
  className?: string;
}

export function ColorLegend({ items, className }: ColorLegendProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-5 border-t px-4 py-3 text-xs text-muted-foreground",
        className
      )}
    >
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={cn("h-2.5 w-2.5 rounded-sm", item.swatchClass)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
