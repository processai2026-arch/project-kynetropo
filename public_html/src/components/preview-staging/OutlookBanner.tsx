import { CheckCircle2 } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

interface OutlookBannerProps {
  icon?: React.ElementType;
  label: string;
  text: string;
  className?: string;
}

export function OutlookBanner({
  icon: Icon = CheckCircle2,
  label,
  text,
  className,
}: OutlookBannerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm",
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        <span className="font-medium">{label} </span>
        {text}
      </span>
    </div>
  );
}
