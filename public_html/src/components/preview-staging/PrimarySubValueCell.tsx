import { cn } from "@/lib/utils";

interface PrimarySubValueCellProps {
  primaryLabel: string;
  subValue?: string | null;
}

export function PrimarySubValueCell({ primaryLabel, subValue }: PrimarySubValueCellProps) {
  return (
    <td className="py-3 px-4 text-card-foreground">
      <span className={cn("block", subValue ? "font-medium" : undefined)}>
        {primaryLabel}
      </span>
      {subValue && (
        <span className="block text-xs text-muted-foreground">{subValue}</span>
      )}
    </td>
  );
}
