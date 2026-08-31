import { cn } from "@/lib/utils";

interface CurrencyCellProps {
  amount: number;
  locale?: string;
  colorClass?: string;
}

const formatCurrency = (n: number, locale: string): string =>
  "₹" + n.toLocaleString(locale, { minimumFractionDigits: 2 });

export function CurrencyCell({
  amount,
  locale = "en-IN",
  colorClass = "text-red-600",
}: CurrencyCellProps) {
  return (
    <td className={cn("py-3 px-4 font-medium", colorClass)}>
      {formatCurrency(amount, locale)}
    </td>
  );
}
