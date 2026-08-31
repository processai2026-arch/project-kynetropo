import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PropertyCompactCardProps {
  /** Primary property title, truncated on overflow */
  title: string;
  /** Short property code, e.g. "PROP-0042" */
  propertyCode: string;
  /** District or locality subtitle */
  district: string;
  /** Raw status string rendered inside the badge, e.g. "available" */
  status: string;
  /**
   * Tailwind class string for the badge color.
   * Comes from the caller's statusStyles map so variants stay centralized.
   * Example: "bg-emerald-50 text-emerald-700 border-emerald-200"
   */
  statusStyle: string;
  /** Pre-formatted price string, e.g. "₹ 45,00,000" */
  formattedPrice: string;
  /**
   * Pre-formatted area string, e.g. "1 200 sq ft".
   * Omit or pass undefined to hide the area slot entirely.
   */
  areaDisplay?: string;
  /** Fired when the card is clicked */
  onClick: () => void;
  /**
   * Context-sensitive call-to-action rendered in the bottom-right slot.
   * Typically a small ghost Button or a plain text link.
   * Pass undefined to leave the slot empty.
   */
  cta?: React.ReactNode;
}

export function PropertyCompactCard({
  title,
  propertyCode,
  district,
  status,
  statusStyle,
  formattedPrice,
  areaDisplay,
  onClick,
  cta,
}: PropertyCompactCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Top row: title + status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-card-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {propertyCode} · {district}
          </p>
        </div>
        <Badge className={cn("border shrink-0 capitalize", statusStyle)}>
          {status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Bottom row: price + optional area + CTA slot */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formattedPrice}</span>
          {areaDisplay && <span>{areaDisplay}</span>}
        </div>
        {cta && <div className="shrink-0">{cta}</div>}
      </div>
    </div>
  );
}

export default PropertyCompactCard;
