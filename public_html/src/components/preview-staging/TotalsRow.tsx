import { cn } from "@/lib/utils";

interface TotalsRowProps {
  label: string;
  labelColSpan: number;
  values: string[];
  variant?: "default" | "strong";
  className?: string;
}

export function TotalsRow({
  label,
  labelColSpan,
  values,
  variant = "default",
  className,
}: TotalsRowProps) {
  return (
    <tr
      className={cn(
        "border-t font-semibold",
        variant === "default" && "bg-muted/40",
        variant === "strong" && "bg-muted/60 text-foreground",
        className
      )}
    >
      <td colSpan={labelColSpan} className="px-4 py-3">
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className="px-4 py-3 text-right">
          {v}
        </td>
      ))}
    </tr>
  );
}
