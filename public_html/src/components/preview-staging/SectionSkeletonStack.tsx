import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SectionSkeletonStackProps {
  count?: number;
  className?: string;
}

export function SectionSkeletonStack({
  count = 3,
  className,
}: SectionSkeletonStackProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
