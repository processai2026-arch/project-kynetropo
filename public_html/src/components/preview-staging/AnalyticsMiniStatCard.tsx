import { cn } from "@/lib/utils";

interface AnalyticsMiniStatCardProps {
  label: string;
  value: string | number;
  valueClass?: string;
  caption?: string;
}

export function AnalyticsMiniStatCard({
  label,
  value,
  valueClass = "text-card-foreground",
  caption,
}: AnalyticsMiniStatCardProps) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold mt-1", valueClass)}>{value}</p>
      {caption && (
        <p className="text-xs text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}
