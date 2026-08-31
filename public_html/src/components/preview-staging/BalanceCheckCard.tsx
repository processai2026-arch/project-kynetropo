import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceCheckCardProps {
  labelA: string;
  valueA: number;
  labelB: string;
  valueB: number;
  title?: string;
  tolerance?: number;
}

export function BalanceCheckCard({
  labelA,
  valueA,
  labelB,
  valueB,
  title,
  tolerance = 0,
}: BalanceCheckCardProps) {
  const diff = Math.abs(valueA - valueB);
  const balanced = diff <= tolerance;

  return (
    <div className="bg-card rounded-xl border shadow-sm p-4 space-y-1">
      {title && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1">
          {title}
        </p>
      )}

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{labelA}</span>
        <span className="font-medium text-card-foreground">
          ₹{valueA.toLocaleString("en-IN")}
        </span>
      </div>

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{labelB}</span>
        <span className="font-medium text-card-foreground">
          ₹{valueB.toLocaleString("en-IN")}
        </span>
      </div>

      <div
        className={cn(
          "flex justify-between items-center font-semibold pt-1 border-t text-xs",
          balanced ? "text-emerald-600" : "text-red-600"
        )}
      >
        <span className="flex items-center gap-1">
          {balanced ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {balanced ? "Balanced" : "Difference"}
        </span>
        <span>₹{diff.toLocaleString("en-IN")}</span>
      </div>
    </div>
  );
}
