import type { ElementType } from "react";
import { cn } from "@/lib/utils";

interface IconCircleEmptyStateProps {
  colSpan: number;
  icon: ElementType;
  message: string;
  iconClass?: string;
  bgClass?: string;
}

export function IconCircleEmptyState({
  colSpan,
  icon: Icon,
  message,
  iconClass = "text-primary",
  bgClass = "bg-primary/10",
}: IconCircleEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            className={cn(
              "h-12 w-12 rounded-full flex items-center justify-center",
              bgClass
            )}
          >
            <Icon className={cn("h-6 w-6", iconClass)} />
          </div>
          <p className="text-muted-foreground text-base">{message}</p>
        </div>
      </td>
    </tr>
  );
}
