import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DialogSectionSkeletonProps {
  loading: boolean;
  height?: string;
  children: ReactNode;
}

export function DialogSectionSkeleton({
  loading,
  height = "h-32",
  children,
}: DialogSectionSkeletonProps) {
  if (loading) {
    return <Skeleton className={cn("w-full rounded-lg", height)} />;
  }
  return <>{children}</>;
}
