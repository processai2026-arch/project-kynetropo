import type { AllocationResultData } from "@/lib/api/inventory";
import { qty } from "@/lib/inventoryFormat";

interface AllocationResultProps {
  result: AllocationResultData | null | undefined;
}

export function AllocationResult({ result }: AllocationResultProps) {
  if (!result) return null;
  const allocations = result.allocations ?? [];

  if (allocations.length === 0) {
    return <p className="text-sm text-muted-foreground">No allocation data available.</p>;
  }

  return (
    <div className="space-y-1">
      {allocations.map((a, i) => (
        <div key={i} className="flex items-center justify-between gap-4 rounded-md border px-3 py-1.5 text-sm">
          <span className="text-card-foreground">
            {a.zone_name ?? `Zone ${i + 1}`}
            {a.zone_type && (
              <span className="ml-1 text-xs text-muted-foreground">({a.zone_type})</span>
            )}
          </span>
          <span className="font-medium tabular-nums text-card-foreground">
            {qty(a.quantity ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}
