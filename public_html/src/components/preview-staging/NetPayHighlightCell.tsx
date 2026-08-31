import { cn } from "@/lib/utils";

interface NetPayHighlightCellProps {
  value: number;
  formatter?: (n: number) => string;
  className?: string;
}

const defaultFormatter = (n: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

export function NetPayHighlightCell({
  value,
  formatter = defaultFormatter,
  className,
}: NetPayHighlightCellProps) {
  return (
    <td className={cn("px-4 py-3 text-right font-bold text-primary", className)}>
      {formatter(value)}
    </td>
  );
}
