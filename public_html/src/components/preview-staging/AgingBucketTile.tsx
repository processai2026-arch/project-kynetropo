import { cn } from "@/lib/utils";

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
