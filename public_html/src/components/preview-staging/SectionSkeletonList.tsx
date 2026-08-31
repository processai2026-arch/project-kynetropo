import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SectionSkeletonListProps {
  loading: boolean;
  count?: number;
  height?: string;
}

export function SectionSkeletonList({
  loading,
  count = 3,
  height = "h-20",
}: SectionSkeletonListProps) {
  if (!loading) return null;

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("w-full rounded-xl", height)} />
      ))}
    </div>
  );
}
