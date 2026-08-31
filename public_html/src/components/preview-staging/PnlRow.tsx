import { cn } from "@/lib/utils";

interface PnlRowProps {
  label: string;
  value: number;
  bold?: boolean;
  indent?: boolean;
  positive?: boolean;
  negative?: boolean;
}

const fmt = (v: number): string =>
  "₹" +
  Math.abs(v).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function PnlRow({
  label,
  value,
  bold = false,
  indent = false,
  positive = false,
  negative = false,
}: PnlRowProps) {
  const color = positive
    ? "text-emerald-600"
    : negative
    ? "text-red-600"
    : "text-card-foreground";

  return (
    <div
      className={cn(
        "flex items-center justify-between py-2.5 border-b last:border-0",
        indent && "pl-6"
      )}
    >
      <span
        className={cn(
          "text-sm",
          bold ? "font-semibold text-foreground" : "text-card-foreground"
        )}
      >
        {label}
      </span>
      <span className={cn("text-sm font-mono", bold && "font-bold", color)}>
        {value < 0 ? "-" : ""}
        {fmt(value)}
      </span>
    </div>
  );
}
