import { InboxIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardEmptyStateProps {
  message?: string;
  className?: string;
}

export function CardEmptyState({
  message = 'No items found. Click "Add" to create one.',
  className,
}: CardEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        "bg-card rounded-xl border border-border",
        className
      )}
    >
      <InboxIcon className="h-8 w-8 mb-3 text-muted-foreground opacity-40" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
