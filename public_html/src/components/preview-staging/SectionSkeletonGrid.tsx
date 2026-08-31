import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SectionSkeletonGridProps {
  loading: boolean;
  count?: number;
  skeletonHeight?: string;
  children: React.ReactNode;
}

export function SectionSkeletonGrid({
  loading,
  count = 3,
  skeletonHeight = "h-28",
  children,
}: SectionSkeletonGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className={cn("rounded-xl", skeletonHeight)} />
        ))}
      </div>
    );
  }

  return <>{children}</>;
}
