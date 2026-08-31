import React from "react";
import { cn } from "@/lib/utils";

export interface ActivityTimelineItemProps {
  /**
   * Tailwind border-l-* color class applied to the left accent strip.
   * Example: "border-blue-400", "border-emerald-400"
   */
  borderColor: string;
  /**
   * Icon node rendered at the left of the content area.
   * Pass a lucide-react icon sized h-4 w-4 with an appropriate color class.
   */
  icon: React.ReactNode;
  /** Primary label for the timeline event. */
  title: string;
  /** Optional supporting detail text. Clamped to two lines. */
  detail?: string;
  /**
   * Optional rupee amount. Renders below the detail in emerald-green
   * with Indian-locale formatting (en-IN) when provided.
   * Pass null or undefined to hide the amount row entirely.
   */
  amount?: number | null;
  /** Human-readable relative time string, e.g. "2 days ago". */
  relativeTime: string;
}

export function ActivityTimelineItem({
  borderColor,
  icon,
  title,
  detail,
  amount,
  relativeTime,
}: ActivityTimelineItemProps) {
  return (
    <div className={cn("border-l-4 rounded-r-lg p-3 bg-muted/10", borderColor)}>
      <div className="flex items-start justify-between gap-2">
        {/* Left: icon + text stack */}
        <div className="flex items-start gap-2 min-w-0">
          <span className="mt-0.5 shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-card-foreground leading-snug">
              {title}
            </p>
            {detail && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {detail}
              </p>
            )}
            {amount != null && (
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                ₹{Number(amount).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </div>

        {/* Right: relative timestamp */}
        <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
          {relativeTime}
        </span>
      </div>
    </div>
  );
}

export default ActivityTimelineItem;
