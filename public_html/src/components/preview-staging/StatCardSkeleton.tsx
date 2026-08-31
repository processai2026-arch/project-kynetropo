import { Skeleton } from "@/components/ui/skeleton";

export interface StatCardSkeletonProps {
  /** Number of skeleton cards to render side-by-side (default: 1). */
  count?: number;
}

/**
 * StatCardSkeleton
 *
 * Loading placeholder that matches the visual footprint of a StatCard.
 * Render it inside the stats row while async data resolves.
 */
export function StatCardSkeleton({ count = 1 }: StatCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border shadow-sm p-5">
          {/* title line */}
          <Skeleton className="h-4 w-28 mb-3" />
          {/* value line */}
          <Skeleton className="h-7 w-24 mb-2" />
          {/* subtitle line */}
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </>
  );
}

export default StatCardSkeleton;
