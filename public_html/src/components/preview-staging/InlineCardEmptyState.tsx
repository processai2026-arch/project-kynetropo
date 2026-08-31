import { cn } from "@/lib/utils";

interface InlineCardEmptyStateProps {
  message?: string;
  className?: string;
}

export function InlineCardEmptyState({
  message = "No items found.",
  className,
}: InlineCardEmptyStateProps) {
  return (
    <p className={cn("text-center text-sm text-muted-foreground py-6", className)}>
      {message}
    </p>
  );
}
