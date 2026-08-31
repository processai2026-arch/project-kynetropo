import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfigWarningBannerProps {
  message: string;
  className?: string;
}

export function ConfigWarningBanner({ message, className }: ConfigWarningBannerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
