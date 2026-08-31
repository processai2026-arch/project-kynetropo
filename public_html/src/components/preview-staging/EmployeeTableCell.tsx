import { cn } from "@/lib/utils";

interface EmployeeTableCellProps {
  name: string;
  employeeKey: string;
  department?: string;
  className?: string;
}

export function EmployeeTableCell({
  name,
  employeeKey,
  department,
  className,
}: EmployeeTableCellProps) {
  return (
    <td className={cn("px-4 py-3", className)}>
      <div className="font-medium text-sm text-card-foreground leading-snug">
        {name}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {employeeKey}
        {department ? ` · ${department}` : ""}
      </div>
    </td>
  );
}

export default EmployeeTableCell;
