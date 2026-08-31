import { cn } from "@/lib/utils";

export interface DetailSubTableColumn {
  label: string;
  align?: "left" | "right";
}

export interface DetailSubTableProps<T extends Record<string, unknown>> {
  columns: DetailSubTableColumn[];
  rows: T[];
  rowKey: keyof T;
  emptyMessage?: string;
  renderRow: (row: T) => React.ReactNode;
}

export function DetailSubTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No records found",
  renderRow,
}: DetailSubTableProps<T>) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th
                key={col.label}
                className={cn(
                  "px-3 py-2 font-medium",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-6 text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={String(row[rowKey])} className="border-t">
              {renderRow(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface DetailSubTableCellProps {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function DetailSubTableCell({
  primary,
  secondary,
  align,
  className,
}: DetailSubTableCellProps) {
  return (
    <td className={cn("px-3 py-2", align === "right" && "text-right", className)}>
      <div className="font-medium">{primary}</div>
      {secondary !== undefined && secondary !== null && secondary !== "" && (
        <div className="text-xs text-muted-foreground">{secondary}</div>
      )}
    </td>
  );
}
