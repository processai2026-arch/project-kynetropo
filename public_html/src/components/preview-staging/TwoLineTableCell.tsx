import { cn } from "@/lib/utils";

interface TwoLineTableCellProps {
  primary: string;
  secondary: string;
  className?: string;
}

export function TwoLineTableCell({
  primary,
  secondary,
  className,
}: TwoLineTableCellProps) {
  return (
    <td className={cn("px-4 py-3", className)}>
      <div className="font-medium text-card-foreground">{primary}</div>
      <div className="text-xs text-muted-foreground">{secondary}</div>
    </td>
  );
}
