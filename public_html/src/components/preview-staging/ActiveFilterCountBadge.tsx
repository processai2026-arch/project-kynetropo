import React from "react";
import { cn } from "@/lib/utils";

interface ActiveFilterCountBadgeProps {
  /** Number of active filters. Renders nothing when <= 0. */
  count: number;
  /** Optional extra Tailwind classes to override or extend styling. */
  className?: string;
}

export function ActiveFilterCountBadge({ count, className }: ActiveFilterCountBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground",
        className
      )}
    >
      {count}
    </span>
  );
}

export default ActiveFilterCountBadge;
