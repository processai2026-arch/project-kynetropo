import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  cols: number;
  skeletonWidth?: string;
}

export function TableSkeleton({ rows = 5, cols, skeletonWidth = "w-24" }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="py-3 px-4">
              <Skeleton className={`h-4 ${skeletonWidth}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
