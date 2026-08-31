import { cn } from "@/lib/utils";

export interface ColorCodedCurrencyCellProps {
  amount: number;
  role: "credit" | "payable" | "carry-forward" | "neutral";
  suffix?: string;
  showDashWhenZero?: boolean;
  bold?: boolean;
  className?: string;
}

const roleClasses: Record<ColorCodedCurrencyCellProps["role"], string> = {
  credit:          "text-emerald-600",
  payable:         "font-semibold text-amber-600",
  "carry-forward": "text-blue-600 text-xs",
  neutral:         "text-card-foreground",
};

export function ColorCodedCurrencyCell({
  amount,
  role,
  suffix,
  showDashWhenZero = false,
  bold = false,
  className,
}: ColorCodedCurrencyCellProps) {
  const displayValue =
    amount === 0 && showDashWhenZero
      ? "—"
      : `₹${amount.toLocaleString("en-IN")}${suffix ? ` ${suffix}` : ""}`;

  return (
    <td
      className={cn(
        "py-3 px-4",
        roleClasses[role],
        bold && "font-semibold",
        className
      )}
    >
      {displayValue}
    </td>
  );
}
