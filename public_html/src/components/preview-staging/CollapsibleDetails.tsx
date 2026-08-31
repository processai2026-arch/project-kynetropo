import type React from "react";
import { cn } from "@/lib/utils";

interface CollapsibleDetailsProps {
  label: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsibleDetails({
  label,
  count,
  children,
  defaultOpen = false,
  className,
}: CollapsibleDetailsProps) {
  return (
    <details open={defaultOpen} className={cn("border-t", className)}>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-primary hover:bg-muted/30 transition-colors">
        {label} ({count})
      </summary>
      <div className="border-t">{children}</div>
    </details>
  );
}
