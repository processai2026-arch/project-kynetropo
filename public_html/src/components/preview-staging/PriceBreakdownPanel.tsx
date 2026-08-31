import { cn } from "@/lib/utils";

export interface PriceRow {
  label: string;
  value: string;
  color?: string;
}

export interface PriceBreakdownPanelProps {
  rows: PriceRow[];
  totalLabel?: string;
  totalValue: string;
}

export function PriceBreakdownPanel({
  rows,
  totalLabel = "Total",
  totalValue,
}: PriceBreakdownPanelProps) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between">
          <span className="text-muted-foreground">{r.label}</span>
          <span className={cn(r.color ?? "text-card-foreground")}>{r.value}</span>
        </div>
      ))}
      <div className="flex justify-between border-t pt-1.5">
        <span className="font-semibold text-card-foreground">{totalLabel}</span>
        <span className="font-bold text-primary text-lg">{totalValue}</span>
      </div>
    </div>
  );
}
