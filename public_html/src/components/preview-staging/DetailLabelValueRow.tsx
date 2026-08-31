import React from "react";
import { cn } from "@/lib/utils";

export interface DetailLabelValueRowProps {
  /** The field name shown on the left at fixed width */
  label: string;
  /** The field value shown on the right; renders "—" when undefined or null */
  value?: React.ReactNode;
  /** When true, renders the value with font-semibold */
  bold?: boolean;
}

export function DetailLabelValueRow({
  label,
  value,
  bold = false,
}: DetailLabelValueRowProps) {
  return (
    <div className="flex items-start justify-between py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground w-44 shrink-0">{label}</span>
      <span
        className={cn(
          "text-sm text-card-foreground text-right",
          bold && "font-semibold"
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

export default DetailLabelValueRow;
