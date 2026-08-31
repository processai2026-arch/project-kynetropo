import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineDialogLoadingStateProps {
  message?: string;
  className?: string;
}

export function InlineDialogLoadingState({
  message = "Loading details…",
  className,
}: InlineDialogLoadingStateProps) {
  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {message}
    </div>
  );
}
