import { cn } from "@/lib/utils";

interface SignedCurrencyCellProps {
  amount: number;
  isPositive: boolean;
}

export function SignedCurrencyCell({ amount, isPositive }: SignedCurrencyCellProps) {
  return (
    <td className={cn("py-3 px-4 font-medium", isPositive ? "text-emerald-600" : "text-red-600")}>
      {isPositive ? "+" : "-"}
      {"₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
    </td>
  );
}
