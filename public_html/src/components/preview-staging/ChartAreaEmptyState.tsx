import { cn } from "@/lib/utils";

interface ChartAreaEmptyStateProps {
  message: string;
  heightClass?: string;
}

export function ChartAreaEmptyState({
  message,
  heightClass = "h-[300px]",
}: ChartAreaEmptyStateProps) {
  return (
    <p
      className={cn(
        "flex items-center justify-center text-sm text-muted-foreground",
        heightClass
      )}
    >
      {message}
    </p>
  );
}
