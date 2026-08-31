import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SectionSkeletonPlaceholderProps {
  heightClass?: string;
  className?: string;
}

export function SectionSkeletonPlaceholder({
  heightClass = "h-48",
  className,
}: SectionSkeletonPlaceholderProps) {
  return (
    <Skeleton className={cn("w-full rounded-xl", heightClass, className)} />
  );
}
