import React from "react";
import { cn } from "@/lib/utils";

interface FormSectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function FormSectionLabel({ children, className }: FormSectionLabelProps) {
  return (
    <p className={cn("text-xs font-semibold text-muted-foreground uppercase mb-2", className)}>
      {children}
    </p>
  );
}

export default FormSectionLabel;
