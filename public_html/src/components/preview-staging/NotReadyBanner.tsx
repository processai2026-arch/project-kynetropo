import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotReadyBannerProps {
  title: string;
  description: string;
  className?: string;
}

export function NotReadyBanner({ title, description, className }: NotReadyBannerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 bg-muted/50 rounded-xl border p-6 text-sm text-muted-foreground",
        className
      )}
    >
      <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="font-medium text-foreground mb-1">{title}</p>
        <p>{description}</p>
      </div>
    </div>
  );
}
