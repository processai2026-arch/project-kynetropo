import { cn } from "@/lib/utils";

interface MiniStatTileProps {
  label: string;
  value: string | number;
  className?: string;
}

export function MiniStatTile({ label, value, className }: MiniStatTileProps) {
  return (
    <div className={cn("bg-muted/30 rounded-lg p-3", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-card-foreground">{value}</p>
    </div>
  );
}
