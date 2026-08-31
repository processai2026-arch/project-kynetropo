import { cn } from "@/lib/utils";

export interface DeductionItem {
  label: string;
  amount: number;
}

export interface DeductionsSectionBlockProps {
  items: DeductionItem[];
  total: number;
  formatter?: (n: number) => string;
}

const defaultFormatter = (n: number): string =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DeductionsSectionBlock({
  items,
  total,
  formatter = defaultFormatter,
}: DeductionsSectionBlockProps) {
  return (
    <div className={cn("border-t pt-3 space-y-1 text-destructive")}>
      {items.map((item, i) => (
        <div key={i} className="flex justify-between text-sm">
          <span>{item.label}</span>
          <span>−{formatter(item.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between text-sm font-medium pt-1 border-t border-destructive/20 mt-1">
        <span>Total Deductions</span>
        <span>−{formatter(total)}</span>
      </div>
    </div>
  );
}
