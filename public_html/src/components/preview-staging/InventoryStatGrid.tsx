import { cn } from "@/lib/utils";

type StatColor = "neutral" | "warning" | "danger";

export interface InventoryStatItem {
  value: number;
  label: string;
  color: StatColor;
  bordered?: boolean;
}

export interface InventoryStatGridProps {
  items: InventoryStatItem[];
}

const colorMap: Record<StatColor, string> = {
  neutral: "text-card-foreground",
  warning: "text-amber-600",
  danger:  "text-destructive",
};

export function InventoryStatGrid({ items }: InventoryStatGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      {items.map((item, i) => (
        <div
          key={i}
          className={cn("py-2", item.bordered && "border-x border-border")}
        >
          <p className={cn("font-mono font-bold text-xl", colorMap[item.color])}>
            {item.value.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}
