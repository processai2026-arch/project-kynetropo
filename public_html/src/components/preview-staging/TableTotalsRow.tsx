import { cn } from "@/lib/utils";

interface TotalsCell {
  value: string;
  align?: "left" | "right";
}

interface TableTotalsRowProps {
  label?: string;
  cells: TotalsCell[];
}

export function TableTotalsRow({ label = "Totals", cells }: TableTotalsRowProps) {
  return (
    <tr className="bg-muted/30 font-semibold border-t">
      <td className="px-4 py-2 text-sm text-card-foreground">{label}</td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={cn(
            "px-4 py-2 text-sm text-card-foreground",
            c.align === "right" && "text-right"
          )}
        >
          {c.value}
        </td>
      ))}
    </tr>
  );
}
