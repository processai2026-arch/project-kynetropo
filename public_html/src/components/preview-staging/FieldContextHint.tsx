import React from "react";
import { cn } from "@/lib/utils";

interface FieldContextHintProps {
  /** Contextual guidance shown below a form field.
   *  Accepts a plain string or any ReactNode (e.g. a date string built by the caller).
   *  Renders nothing when the value is falsy — no wrapper conditional needed at the call site. */
  hint?: React.ReactNode;
  /** Optional Tailwind class overrides applied to the paragraph element. */
  className?: string;
}

export function FieldContextHint({ hint, className }: FieldContextHintProps) {
  if (!hint) return null;

  return (
    <p className={cn("text-xs text-muted-foreground leading-snug", className)}>
      {hint}
    </p>
  );
}

export default FieldContextHint;
