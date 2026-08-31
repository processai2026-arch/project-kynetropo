import { cn } from "@/lib/utils";

interface SignedCurrencyValueProps {
  value: number;
  className?: string;
}

export function SignedCurrencyValue({ value, className }: SignedCurrencyValueProps) {
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        value >= 0 ? "text-emerald-600" : "text-red-600",
        className
      )}
    >
      ₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
    </span>
  );
}
