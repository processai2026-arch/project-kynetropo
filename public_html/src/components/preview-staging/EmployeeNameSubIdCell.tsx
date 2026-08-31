import { cn } from "@/lib/utils";

interface EmployeeNameSubIdCellProps {
  primary: string;
  secondary?: string;
  className?: string;
}

export function EmployeeNameSubIdCell({
  primary,
  secondary,
  className,
}: EmployeeNameSubIdCellProps) {
  return (
    <td className={cn("px-4 py-3 truncate", className)}>
      <span className="text-sm text-card-foreground">{primary}</span>
      {secondary && (
        <div className="text-xs text-muted-foreground">{secondary}</div>
      )}
    </td>
  );
}
