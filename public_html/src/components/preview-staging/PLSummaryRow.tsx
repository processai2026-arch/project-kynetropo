import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PLSummaryRowProps {
  /** Row label displayed on the left */
  label: string;
  /** Pre-formatted monetary value displayed on the right */
  value: string;
  /** When true renders the positive (profit) variant; false renders the negative (loss) variant */
  isPositive: boolean;
  /** Badge text when isPositive is true — defaults to "PROFIT" */
  positiveLabel?: string;
  /** Badge text when isPositive is false — defaults to "LOSS" */
  negativeLabel?: string;
}

export function PLSummaryRow({
  label,
  value,
  isPositive,
  positiveLabel = "PROFIT",
  negativeLabel = "LOSS",
}: PLSummaryRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-t mt-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-card-foreground">
          {label}
        </span>
        <Badge
          className={cn(
            "text-xs border capitalize",
            isPositive
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-600 border-red-200"
          )}
        >
          {isPositive ? positiveLabel : negativeLabel}
        </Badge>
      </div>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          isPositive ? "text-emerald-700" : "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default PLSummaryRow;
