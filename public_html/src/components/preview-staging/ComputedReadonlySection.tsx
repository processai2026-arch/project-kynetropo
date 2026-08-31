import React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ComputedField {
  /** Display label rendered above the input */
  label: string;
  /** Pre-formatted display value (e.g. "₹1,200.00", "42%") */
  value: string | number;
}

export interface ComputedReadonlySectionProps {
  /** Section heading displayed above the grid. Defaults to "Computed Values (read-only)". */
  heading?: string;
  /** Array of derived fields to render as read-only inputs. */
  computedFields: ComputedField[];
  /**
   * Number of columns in the responsive grid.
   * On screens smaller than `sm` the grid always collapses to a single column.
   * Defaults to 2.
   */
  columns?: 1 | 2 | 3 | 4;
  /**
   * When true, the last field receives `font-semibold` — useful for "Total" rows.
   * Defaults to true.
   */
  boldLast?: boolean;
}

const colClass: Record<number, string> = {
  1: "grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

export function ComputedReadonlySection({
  heading = "Computed Values (read-only)",
  computedFields,
  columns = 2,
  boldLast = true,
}: ComputedReadonlySectionProps) {
  if (computedFields.length === 0) return null;

  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
      <div className={cn("grid grid-cols-1 gap-4", colClass[columns])}>
        {computedFields.map((field, i) => {
          const isLast = boldLast && i === computedFields.length - 1;
          return (
            <div key={field.label} className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">
                {field.label}
              </Label>
              <Input
                value={String(field.value)}
                readOnly
                className={cn(
                  "bg-muted/50 cursor-not-allowed select-none",
                  isLast && "font-semibold"
                )}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ComputedReadonlySection;
