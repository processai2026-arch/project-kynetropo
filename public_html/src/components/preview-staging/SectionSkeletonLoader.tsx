import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SectionSkeletonLoaderProps {
  rows?: number;
  rowHeight?: string;
}

export function SectionSkeletonLoader({
  rows = 5,
  rowHeight = "h-10",
}: SectionSkeletonLoaderProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn(rowHeight, "w-full")} />
      ))}
    </div>
  );
}
