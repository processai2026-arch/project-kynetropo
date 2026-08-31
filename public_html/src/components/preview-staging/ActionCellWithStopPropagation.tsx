import React from "react";
import { cn } from "@/lib/utils";

interface ActionCellWithStopPropagationProps {
  children: React.ReactNode;
  className?: string;
}

export function ActionCellWithStopPropagation({
  children,
  className,
}: ActionCellWithStopPropagationProps) {
  return (
    <td
      className={cn("py-3 px-4", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-1">
        {children}
      </div>
    </td>
  );
}
