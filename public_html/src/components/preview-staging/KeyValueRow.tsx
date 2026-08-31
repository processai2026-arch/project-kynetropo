import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KeyValueRowProps {
  label: string;
  value: ReactNode;
  valueBold?: boolean;
  valueAlign?: "right";
}

export function KeyValueRow({
  label,
  value,
  valueBold = false,
  valueAlign,
}: KeyValueRowProps) {
  return (
    <>
      <div className="flex items-center justify-between py-2.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={cn(
            "text-sm text-card-foreground font-medium",
            valueBold && "font-semibold",
            valueAlign === "right" && "text-right"
          )}
        >
          {value}
        </span>
      </div>
      <div className="border-t border-border" />
    </>
  );
}
