import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BooleanBadgeCellProps {
  /** The boolean value to render */
  value: boolean | null | undefined;
  /** Label shown inside the green badge when value is truthy */
  trueLabel: string;
}

export function BooleanBadgeCell({ value, trueLabel }: BooleanBadgeCellProps) {
  return (
    <td className="py-3 px-4">
      {value ? (
        <Badge
          className={cn(
            "border capitalize",
            "bg-emerald-50 text-emerald-700 border-emerald-200"
          )}
        >
          {trueLabel}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      )}
    </td>
  );
}

export default BooleanBadgeCell;
