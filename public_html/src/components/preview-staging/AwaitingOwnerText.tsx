import React from "react";
import { cn } from "@/lib/utils";

interface AwaitingOwnerTextProps {
  /** Text displayed in the action cell. Defaults to "Awaiting owner". */
  message?: string;
  /** Native tooltip shown on hover. Defaults to a generic permission note. */
  tooltip?: string;
  /** Optional extra Tailwind classes, e.g. to override alignment for a specific table. */
  className?: string;
}

export function AwaitingOwnerText({
  message = "Awaiting owner",
  tooltip = "Only an owner can approve or reject this item",
  className,
}: AwaitingOwnerTextProps) {
  return (
    <div
      className={cn("text-right text-xs text-muted-foreground", className)}
      title={tooltip}
    >
      {message}
    </div>
  );
}

export default AwaitingOwnerText;
