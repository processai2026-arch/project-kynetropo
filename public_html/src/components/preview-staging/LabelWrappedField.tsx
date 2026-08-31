import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LabelWrappedFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function LabelWrappedField({ label, children, className }: LabelWrappedFieldProps) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
