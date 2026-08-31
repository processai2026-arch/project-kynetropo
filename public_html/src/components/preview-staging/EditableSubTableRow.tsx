import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Employee } from "@/lib/api/hr";

export type CellType = "text" | "date" | "select" | "employee";

export interface ColumnDef<T> {
  key: keyof T;
  header: string;
  type: CellType;
  width?: string;
  placeholder?: string;
  /** Required when type is "select" */
  options?: { value: string; label: string }[];
}

export interface EditableSubTableRowProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  rows: T[];
  onUpdate: (id: string, field: keyof T, value: unknown) => void;
  onDelete: (id: string) => void;
  employees?: Employee[];
  emptyMessage?: string;
}

export function EditableSubTableRow<T extends { id: string }>({
  columns,
  rows,
  onUpdate,
  onDelete,
  employees = [],
  emptyMessage = "No rows yet.",
}: EditableSubTableRowProps<T>) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-1">{emptyMessage}</p>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={cn("text-left px-2 py-2 font-medium", col.width)}
              >
                {col.header}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-muted/30 transition-colors">
              {columns.map((col) => {
                const rawVal = row[col.key];
                const strVal = rawVal == null ? "" : String(rawVal);

                if (col.type === "text") {
                  return (
                    <td key={String(col.key)} className="px-2 py-1">
                      <Input
                        value={strVal}
                        placeholder={col.placeholder}
                        onChange={(e) => onUpdate(row.id, col.key, e.target.value)}
                        className="h-9"
                      />
                    </td>
                  );
                }

                if (col.type === "date") {
                  return (
                    <td key={String(col.key)} className="px-2 py-1">
                      <Input
                        type="date"
                        value={strVal}
                        onChange={(e) => onUpdate(row.id, col.key, e.target.value)}
                        className="h-9"
                      />
                    </td>
                  );
                }

                if (col.type === "select") {
                  return (
                    <td key={String(col.key)} className="px-2 py-1">
                      <Select
                        value={strVal}
                        onValueChange={(v) => onUpdate(row.id, col.key, v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={col.placeholder ?? "Select…"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(col.options ?? []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  );
                }

                if (col.type === "employee") {
                  return (
                    <td key={String(col.key)} className="px-2 py-1">
                      <Select
                        value={strVal}
                        onValueChange={(v) => onUpdate(row.id, col.key, v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={col.placeholder ?? "Owner"} />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  );
                }

                return null;
              })}
              <td className="px-1 py-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete(row.id)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
