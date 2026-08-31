import { cn } from "@/lib/utils";

interface FinancialFinalTotalRowProps {
  label: string;
  value: number;
}

export function FinancialFinalTotalRow({ label, value }: FinancialFinalTotalRowProps) {
  const isPositive = value >= 0;
  const valueColor = isPositive ? "text-emerald-600" : "text-red-600";
  const formatted =
    "₹" + Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div className="mt-4 pt-2 border-t-2 border-foreground">
      <div className="flex items-center justify-between py-2.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className={cn("text-sm font-mono font-bold", valueColor)}>
          {value < 0 ? "-" : ""}
          {formatted}
        </span>
      </div>
    </div>
  );
}
