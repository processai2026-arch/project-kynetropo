import { cn } from "@/lib/utils";

interface FullPageLoadingTextProps {
  message?: string;
}

export function FullPageLoadingText({
  message = "Loading…",
}: FullPageLoadingTextProps) {
  return (
    <div className={cn("text-center py-20 text-sm text-muted-foreground")}>
      {message}
    </div>
  );
}
