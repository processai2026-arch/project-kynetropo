import { cn } from "@/lib/utils";

interface InventoryMetricTileProps {
  icon: React.ElementType;
  iconBg?: string;
  iconColor?: string;
  label: string;
  value: string;
}

export function InventoryMetricTile({
  icon: Icon,
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
  label,
  value,
}: InventoryMetricTileProps) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border bg-secondary/30">
      <div className={cn("p-2 rounded-lg", iconBg)}>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold text-card-foreground">{value}</p>
      </div>
    </div>
  );
}
