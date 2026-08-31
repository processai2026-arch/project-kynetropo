import { cn } from "@/lib/utils";

interface CardLoadingPlaceholderProps {
  message?: string;
  className?: string;
}

export function CardLoadingPlaceholder({
  message = "Loading…",
  className,
}: CardLoadingPlaceholderProps) {
  return (
    <div
      className={cn(
        "text-center py-12 text-muted-foreground bg-card rounded-xl border border-border",
        className
      )}
    >
      {message}
    </div>
  );
}
