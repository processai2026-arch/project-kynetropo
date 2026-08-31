import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LabeledFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  required?: boolean;
}

export function LabeledField({
  label,
  children,
  className,
  htmlFor,
  required = false,
}: LabeledFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label
        htmlFor={htmlFor}
        className={cn(
          "text-xs text-muted-foreground",
          required && "after:content-['*'] after:ml-0.5 after:text-destructive"
        )}
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
