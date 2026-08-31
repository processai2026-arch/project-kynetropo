import { cn } from "@/lib/utils";

interface StatsGridSkeletonProps {
  count: number;
  cols?: number;
  lastFullWidth?: boolean;
}

const colsClassMap: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

const colSpanClassMap: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
};

export function StatsGridSkeleton({
  count,
  cols = 2,
  lastFullWidth = true,
}: StatsGridSkeletonProps) {
  const gridClass = colsClassMap[cols] ?? "grid-cols-2";
  const fullSpanClass = colSpanClassMap[cols] ?? "col-span-2";
  const isLastOrphan = count % cols !== 0;

  return (
    <div className={cn("grid gap-4 text-sm", gridClass)}>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className={cn(
            "p-3 border rounded-lg text-center animate-pulse",
            lastFullWidth && i === count - 1 && isLastOrphan && fullSpanClass
          )}
        >
          <div className="h-8 bg-muted rounded mb-1 mx-auto w-16" />
          <div className="h-3 bg-muted rounded mx-auto w-20" />
        </div>
      ))}
    </div>
  );
}
