import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PercentageSumIndicatorProps {
  /** Running total of all milestone/stage percentages entered so far */
  totalPct: number;
  /** The exact value that totalPct must equal to be considered valid (typically 100) */
  required: number;
}

export function PercentageSumIndicator({ totalPct, required }: PercentageSumIndicatorProps) {
  const isValid = totalPct === required;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2 text-sm border",
        isValid
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-600 border-red-200"
      )}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5">
        {isValid ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        Total
      </span>
      <span className="font-bold tabular-nums">
        {totalPct.toFixed(1)}%
        {!isValid && (
          <span className="ml-1.5 font-normal text-xs opacity-80">
            (must equal {required}%)
          </span>
        )}
      </span>
    </div>
  );
}

export default PercentageSumIndicator;
