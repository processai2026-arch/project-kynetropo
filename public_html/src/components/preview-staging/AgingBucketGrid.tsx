import { cn } from "@/lib/utils";

export interface AgingBucketItem {
  key: string;
  label: string;
  color: string;
  value: number;
}

interface AgingBucketTileProps {
  label: string;
  value: string;
  color: string;
}

export function AgingBucketTile({ label, value, color }: AgingBucketTileProps) {
  return (
    <div className={cn("rounded-lg border px-3 py-3 text-center", color)}>
      <p className="text-xs font-medium mb-1">{label}</p>
      <p className="text-base font-bold font-mono">{value}</p>
    </div>
  );
}

interface AgingBucketGridProps {
  title: string;
  buckets: AgingBucketItem[];
  fmt: (n: number) => string;
}

export function AgingBucketGrid({ title, buckets, fmt }: AgingBucketGridProps) {
  return (
    <div className="bg-card rounded-xl border shadow-sm p-5">
      <p className="text-sm font-semibold text-card-foreground mb-4">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {buckets.map((b) => (
          <AgingBucketTile key={b.key} label={b.label} value={fmt(b.value)} color={b.color} />
        ))}
      </div>
    </div>
  );
}
