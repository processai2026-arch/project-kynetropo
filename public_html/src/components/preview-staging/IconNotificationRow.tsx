import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface IconNotificationRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
  fallback?: string;
  className?: string;
}

export function IconNotificationRow({
  icon: Icon,
  label,
  value,
  fallback = "—",
  className,
}: IconNotificationRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5",
        className
      )}
    >
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <div className="text-left">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-card-foreground">{value || fallback}</p>
      </div>
    </div>
  );
}
