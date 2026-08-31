import { cn } from "@/lib/utils";

export interface PlatformMetricCardStat {
  label: string;
  value: string;
}

export interface PlatformMetricCardProps {
  name: string;
  headlineValue: string;
  stats?: PlatformMetricCardStat[];
  className?: string;
}

export function PlatformMetricCard({
  name,
  headlineValue,
  stats = [],
  className,
}: PlatformMetricCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border shadow-sm p-4", className)}>
      <p className="text-sm font-semibold text-card-foreground capitalize mb-2">{name}</p>
      <p className="text-xl font-bold text-foreground">{headlineValue}</p>
      {stats.length > 0 && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {stats.map((s) => (
            <p key={s.label}>
              {s.label}: {s.value}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
