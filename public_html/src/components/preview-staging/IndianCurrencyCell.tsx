import { cn } from "@/lib/utils";

interface IndianCurrencyCellProps {
  value: number;
  className?: string;
  variant?: "neutral" | "positive" | "negative" | "auto";
}

const variantClasses: Record<string, string> = {
  neutral:  "text-card-foreground",
  positive: "text-emerald-600",
  negative: "text-destructive",
};

function formatINR(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-IN");
  return value < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

export function IndianCurrencyCell({
  value,
  className,
  variant = "neutral",
}: IndianCurrencyCellProps) {
  const resolved =
    variant === "auto"
      ? value > 0 ? "positive" : value < 0 ? "negative" : "neutral"
      : variant;

  return (
    <td
      className={cn(
        "py-3 px-4",
        variantClasses[resolved] ?? "text-card-foreground",
        className
      )}
    >
      {formatINR(value)}
    </td>
  );
}
