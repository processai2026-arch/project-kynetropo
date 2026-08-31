import { cn } from "@/lib/utils";

interface TotalsGrandRowProps {
  label?: string;
  value: string;
  bold?: boolean;
}

export function TotalsGrandRow({
  label = "Grand Total",
  value,
  bold = true,
}: TotalsGrandRowProps) {
  return (
    <div
      className={cn(
        "flex justify-between border-t pt-2 mt-2 text-base",
        bold ? "font-semibold" : "font-normal"
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
