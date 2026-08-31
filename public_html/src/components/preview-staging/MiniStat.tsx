import { cn } from "@/lib/utils";

interface MiniStatProps {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  className?: string;
}

export function MiniStat({ label, value, valueClassName, className }: MiniStatProps) {
  return (
    <div className={cn("bg-muted/30 rounded-lg p-3", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold text-card-foreground mt-0.5", valueClassName)}>{value}</p>
    </div>
  );
}
