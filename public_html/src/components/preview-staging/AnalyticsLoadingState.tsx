import { cn } from "@/lib/utils";

interface AnalyticsLoadingStateProps {
  message?: string;
  className?: string;
}

export function AnalyticsLoadingState({
  message,
  className,
}: AnalyticsLoadingStateProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center py-20 text-sm text-muted-foreground",
        className
      )}
    >
      {message ?? "Loading analytics…"}
    </div>
  );
}
