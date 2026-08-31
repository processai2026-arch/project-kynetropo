import { cn } from "@/lib/utils";

interface PurchasedPropertyRowProps {
  title: string;
  propertyCode: string;
  formattedPrice: string;
  className?: string;
}

export function PurchasedPropertyRow({
  title,
  propertyCode,
  formattedPrice,
  className,
}: PurchasedPropertyRowProps) {
  return (
    <div
      className={cn(
        "w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-card-foreground truncate">
          {title}
        </p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          {propertyCode}
        </p>
      </div>
      <span className="text-sm font-semibold text-card-foreground shrink-0 tabular-nums">
        {formattedPrice}
      </span>
    </div>
  );
}

export default PurchasedPropertyRow;
