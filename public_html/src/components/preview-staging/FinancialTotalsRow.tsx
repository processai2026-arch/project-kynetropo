import { cn } from "@/lib/utils";

interface FinancialTotalsRowProps {
  label: string;
  value: number;
  className?: string;
}

export function FinancialTotalsRow({ label, value, className }: FinancialTotalsRowProps) {
  return (
    <div
      className={cn(
        "flex justify-between py-2 font-semibold text-foreground border-t mt-1",
        className
      )}
    >
      <span>{label}</span>
      <span>₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
    </div>
  );
}
