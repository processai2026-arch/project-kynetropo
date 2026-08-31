import React from "react";

interface FieldHintTextProps {
  /** Content to display as the hint. Accepts a string or any React node. */
  children: React.ReactNode;
}

/**
 * FieldHintText
 *
 * Tiny muted helper text rendered below a form field.
 * Follows the design-system caption/helper scale:
 *   text-xs text-muted-foreground
 *
 * Usage:
 *   <FieldHintText>Auto-assigned based on territory.</FieldHintText>
 */
export function FieldHintText({ children }: FieldHintTextProps) {
  return (
    <p className="text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export default FieldHintText;
