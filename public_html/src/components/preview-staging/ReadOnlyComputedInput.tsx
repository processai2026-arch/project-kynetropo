import React from "react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { inrFull } from "@/lib/currency";

export interface ReadOnlyComputedInputProps {
  /** Field label shown above the input */
  label: string;
  /** Live-computed numeric value (formatted as ₹ with 2 decimal places) */
  value: number;
  /** Optional formula hint shown below the input (e.g. "Gross − TDS − Charges") */
  hint?: string;
}

export function ReadOnlyComputedInput({ label, value, hint }: ReadOnlyComputedInputProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Input
        value={inrFull(value)}
        readOnly
        tabIndex={-1}
        aria-label={label}
        className={cn(
          "bg-muted/50 cursor-not-allowed select-all font-medium text-foreground",
          "focus-visible:ring-0 focus-visible:ring-offset-0"
        )}
      />
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export default ReadOnlyComputedInput;
