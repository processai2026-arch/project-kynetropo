import { cn } from "@/lib/utils";

interface EarningsLineItemRowProps {
  label: string;
  amount: string;
  bold?: boolean;
}

export function EarningsLineItemRow({
  label,
  amount,
  bold = false,
}: EarningsLineItemRowProps) {
  return (
    <div
      className={cn(
        "flex justify-between items-center py-1.5 text-sm",
        bold
          ? "font-medium text-card-foreground"
          : "text-muted-foreground"
      )}
    >
      <span>{label}</span>
      <span className="text-card-foreground tabular-nums">{amount}</span>
    </div>
  );
}
