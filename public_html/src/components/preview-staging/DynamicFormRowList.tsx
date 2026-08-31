import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

export interface ColumnDef<T> {
  key: keyof T;
  label: string;
  placeholder?: string;
  type?: "text" | "number" | "date";
  width?: string;
}

export interface DynamicFormRowListProps<T extends Record<string, string | number>> {
  rows: T[];
  columns: ColumnDef<T>[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, key: keyof T, value: string) => void;
  addLabel?: string;
  minRows?: number;
  className?: string;
  disabled?: boolean;
}

export function DynamicFormRowList<T extends Record<string, string | number>>({
  rows,
  columns,
  onAdd,
  onRemove,
  onUpdate,
  addLabel = "Add Row",
  minRows = 1,
  className,
  disabled = false,
}: DynamicFormRowListProps<T>) {
  const colTemplate = columns
    .map((col) => col.width ?? "1fr")
    .concat("40px")
    .join(" ");

  return (
    <div className={cn("space-y-2", className)}>
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid gap-2 items-end"
          style={{
            gridTemplateColumns: `repeat(1, 1fr)`,
          }}
        >
          <div
            className="hidden md:grid gap-2 items-end"
            style={{
              gridTemplateColumns: colTemplate,
            }}
          >
            {columns.map((col) => (
              <div key={String(col.key)} className="space-y-1.5">
                {index === 0 && (
                  <Label className="text-xs text-muted-foreground">{col.label}</Label>
                )}
                {index !== 0 && <div className="h-[18px]" aria-hidden />}
                <Input
                  type={col.type ?? "text"}
                  value={String(row[col.key] ?? "")}
                  placeholder={col.placeholder}
                  disabled={disabled}
                  onChange={(e) => onUpdate(index, col.key, e.target.value)}
                />
              </div>
            ))}

            <div className={cn("flex items-end", index === 0 ? "pb-0 pt-[calc(18px+6px)]" : "")}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled || rows.length <= minRows}
                onClick={() => onRemove(index)}
                className={cn(
                  "shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                  rows.length <= minRows && "opacity-30 pointer-events-none",
                )}
                aria-label="Remove row"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="md:hidden border rounded-lg p-3 space-y-2 bg-card relative">
            {columns.map((col) => (
              <div key={String(col.key)} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{col.label}</Label>
                <Input
                  type={col.type ?? "text"}
                  value={String(row[col.key] ?? "")}
                  placeholder={col.placeholder}
                  disabled={disabled}
                  onChange={(e) => onUpdate(index, col.key, e.target.value)}
                />
              </div>
            ))}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={disabled || rows.length <= minRows}
              onClick={() => onRemove(index)}
              className={cn(
                "absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                rows.length <= minRows && "opacity-30 pointer-events-none",
              )}
              aria-label="Remove row"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={onAdd}
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
