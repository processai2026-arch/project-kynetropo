import { cn } from "@/lib/utils";

interface FullPageTextLoadingStateProps {
  message?: string;
  className?: string;
}

export function FullPageTextLoadingState({
  message = "Loading…",
  className,
}: FullPageTextLoadingStateProps) {
  return (
    <div className={cn("p-6 text-sm text-muted-foreground", className)}>
      {message}
    </div>
  );
}
