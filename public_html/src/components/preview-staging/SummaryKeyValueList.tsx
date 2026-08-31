import { cn } from "@/lib/utils";

export interface SummaryRow {
  /** Left-side descriptor rendered in muted text */
  label: string;
  /** Right-side value; accepts a string or any JSX node (e.g. a Badge) */
  value: string | React.ReactNode;
  /** When true, renders the value in monospace font at xs size */
  mono?: boolean;
}

export interface SummaryKeyValueListProps {
  /** Rows displayed above the highlighted total row */
  rows: SummaryRow[];
  /** Label for the bordered total row at the bottom */
  totalLabel: string;
  /** Value for the bordered total row at the bottom */
  totalValue: string | React.ReactNode;
  /** Optional Tailwind classes applied to the root element */
  className?: string;
}

export function SummaryKeyValueList({
  rows,
  totalLabel,
  totalValue,
  className,
}: SummaryKeyValueListProps) {
  return (
    <div className={cn("space-y-2 text-sm", className)}>
      {rows.map((row, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span className="text-muted-foreground shrink-0">{row.label}</span>
          <span
            className={cn(
              "text-card-foreground text-right",
              row.mono && "font-mono text-xs"
            )}
          >
            {row.value}
          </span>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t border-border pt-2">
        <span className="font-semibold text-foreground shrink-0">{totalLabel}</span>
        <span className="font-bold text-foreground text-right">{totalValue}</span>
      </div>
    </div>
  );
}

export default SummaryKeyValueList;
