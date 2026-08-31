import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface NotificationSkeletonRowProps {
  count?: number;
  className?: string;
}

export function NotificationSkeletonRow({
  count = 5,
  className,
}: NotificationSkeletonRowProps) {
  return (
    <div className={cn("", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 py-3 border-b last:border-0">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
        </div>
      ))}
    </div>
  );
}
