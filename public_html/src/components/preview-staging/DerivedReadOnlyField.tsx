import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface DerivedReadOnlyFieldProps {
  /** Field label rendered above the value. */
  label: string;
  /** The derived value to display. When absent or empty the placeholder is shown. */
  value?: string | null;
  /** Fallback text rendered when value is absent. Defaults to "—". */
  placeholder?: string;
  /** Optional extra class names applied to the outer wrapper div. */
  className?: string;
}

export function DerivedReadOnlyField({
  label,
  value,
  placeholder = "—",
  className,
}: DerivedReadOnlyFieldProps) {
  const hasValue = value != null && value !== "";

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      <p
        className={cn(
          "min-h-[2.25rem] rounded-md border border-border bg-muted/30 px-3 py-2 text-sm",
          hasValue ? "text-card-foreground" : "text-muted-foreground"
        )}
      >
        {hasValue ? value : placeholder}
      </p>
    </div>
  );
}

export default DerivedReadOnlyField;
