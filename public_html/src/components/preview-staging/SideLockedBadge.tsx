import { cn } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

type Side = "sale" | "purchase";

interface SideLockedBadgeProps {
  /** Locked transaction direction. "purchase" = money out, "sale" = money in. */
  side: Side;
  /** Optional extra Tailwind classes appended to the root element. */
  className?: string;
}

export function SideLockedBadge({ side, className }: SideLockedBadgeProps) {
  const isPurchase = side === "purchase";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium w-fit border select-none",
        isPurchase
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-primary/10 text-primary border-primary/20",
        className
      )}
    >
      {isPurchase ? (
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>
        {isPurchase
          ? "Money going out — company buying this property"
          : "Money coming in — payment from the buyer"}
      </span>
    </div>
  );
}

export default SideLockedBadge;
