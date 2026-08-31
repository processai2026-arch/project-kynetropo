import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ValueWithSubLabelProps {
  primary: ReactNode;
  secondary: ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function ValueWithSubLabel({
  primary,
  secondary,
  align = "left",
  className,
}: ValueWithSubLabelProps) {
  return (
    <td
      className={cn(
        "px-4 py-3",
        align === "right" && "text-right",
        className
      )}
    >
      {primary}
      <div className="text-xs text-muted-foreground">{secondary}</div>
    </td>
  );
}
