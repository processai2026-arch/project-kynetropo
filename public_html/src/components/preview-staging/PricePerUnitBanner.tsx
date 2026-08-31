import React from "react";
import { cn } from "@/lib/utils";

interface PricePerUnitBannerProps {
  /** The area unit label shown in the caption, e.g. "sq ft" or "sq m" */
  unitLabel: string;
  /** The formatted price string displayed right-aligned, e.g. "₹4,500 / sq ft" */
  priceDisplay: string;
  /** Optional extra Tailwind classes appended to the banner wrapper */
  className?: string;
}

export function PricePerUnitBanner({
  unitLabel,
  priceDisplay,
  className,
}: PricePerUnitBannerProps) {
  return (
    <div
      className={cn(
        "col-span-2 rounded-lg bg-primary/5 border border-primary/20 px-4 py-2",
        "flex items-center justify-between gap-4",
        className
      )}
    >
      <div className="space-y-0.5">
        <span className="text-xs text-muted-foreground">
          Price / {unitLabel} (Auto Calculated)
        </span>
        <p className="text-[11px] leading-none text-muted-foreground/70">
          Based on Selling Price &divide; Total Property Area
        </p>
      </div>

      <div className="shrink-0 text-right">
        <span className="text-sm font-semibold text-primary">{priceDisplay}</span>
      </div>
    </div>
  );
}

export default PricePerUnitBanner;
