import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FulfilmentBannerProps {
  hasShortfall: boolean;
  message: string;
}

export function FulfilmentBanner({ hasShortfall, message }: FulfilmentBannerProps) {
  const Icon = hasShortfall ? AlertTriangle : CheckCircle2;

  return (
    <div
      className={cn(
        "rounded-lg p-3 text-sm mb-2 flex items-center gap-2",
        hasShortfall
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
