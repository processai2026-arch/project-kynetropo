import { cn } from "@/lib/utils";

export type ComputedAmountVariant = "neutral" | "igst" | "cgst" | "total" | "charge";

export interface ComputedAmountCellProps {
  value: string | number;
  variant?: ComputedAmountVariant;
}

export function ComputedAmountCell({ value, variant = "neutral" }: ComputedAmountCellProps) {
  return (
    <div
      className={cn(
        "h-8 flex items-center px-2 text-xs rounded-md border min-w-[70px]",
        variant === "igst"
          ? "text-blue-600 bg-blue-50 border-blue-200"
          : variant === "cgst"
          ? "text-orange-600 bg-orange-50 border-orange-200"
          : variant === "charge"
          ? "text-amber-800 bg-amber-100 border-amber-200 font-semibold"
          : variant === "total"
          ? "text-card-foreground bg-muted/30 border-border font-semibold"
          : "text-muted-foreground bg-muted/30 border-border"
      )}
    >
      &#8377;{value || "0.00"}
    </div>
  );
}
