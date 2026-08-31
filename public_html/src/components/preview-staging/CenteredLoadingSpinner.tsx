import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CenteredLoadingSpinnerProps {
  label?: string;
  py?: string;
}

export function CenteredLoadingSpinner({
  label,
  py = "py-12",
}: CenteredLoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center text-muted-foreground", py)}>
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      {label ?? "Loading…"}
    </div>
  );
}
