import { cn } from "@/lib/utils";

interface NegativeAmountDisplayProps {
  value: number;
  formatter: (n: number) => string;
  alwaysShow?: boolean;
}

export function NegativeAmountDisplay({
  value,
  formatter,
  alwaysShow = true,
}: NegativeAmountDisplayProps) {
  const isNegative = value > 0;

  return (
    <td
      className={cn(
        "px-4 py-3 text-right",
        isNegative ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {isNegative
        ? `−${formatter(value)}`
        : alwaysShow
        ? formatter(0)
        : "—"}
    </td>
  );
}
