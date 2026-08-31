import React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LegendItem {
  /** Text label shown beside the swatch */
  label: string;
  /**
   * Tailwind utility classes applied directly to the swatch element.
   *
   * Filled example:   "bg-emerald-200"
   * Outlined example: "border border-amber-500"
   * Combined example: "bg-purple-100 border border-purple-400"
   */
  swatchClass: string;
}

export interface CalendarLegendBarProps {
  items: LegendItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarLegendBar({ items }: CalendarLegendBarProps) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border px-4 py-3">
      {items.map((item) => (
        <span
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", item.swatchClass)}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default CalendarLegendBar;
