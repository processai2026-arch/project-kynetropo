import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface ReportFilterBarProps {
  children: ReactNode;
  className?: string;
  title?: string;
  badge?: ReactNode;
}

export function ReportFilterBar({
  children,
  className,
  title,
  badge,
}: ReportFilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4",
        className
      )}
    >
      {(title || badge) && (
        <div className="flex w-full items-center justify-between pb-1">
          {title ? (
            <span className="text-sm font-semibold text-card-foreground">
              {title}
            </span>
          ) : (
            <span />
          )}
          {badge}
        </div>
      )}
      {children}
    </div>
  );
}
