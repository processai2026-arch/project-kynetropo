import { cn } from "@/lib/utils";

interface LowStockAlertRowProps {
  name: string;
  code: string;
  currentValue: number;
  threshold: number;
  onClick?: () => void;
}

export function LowStockAlertRow({
  name,
  code,
  currentValue,
  threshold,
  onClick,
}: LowStockAlertRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors",
        onClick ? "cursor-pointer" : "cursor-default"
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-card-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{code}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-mono font-semibold text-amber-600">{currentValue}</p>
        <p className="text-xs text-muted-foreground">/ {threshold} min</p>
      </div>
    </div>
  );
}
