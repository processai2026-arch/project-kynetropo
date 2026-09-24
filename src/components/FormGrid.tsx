import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormGridProps {
  children: ReactNode;
  className?: string;
}

interface FormRowProps {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  /**
   * Put the label above the control instead of beside it.
   *
   * The side-by-side layout spends a fixed 10rem on the label, and it switches
   * on at the `sm` VIEWPORT width — which says nothing about how much room the
   * form actually has. Inside a third-width sidebar on a wide screen that left
   * a select about eight characters to work with, so placeholders truncated and
   * comboboxes wrapped onto two lines. Narrow containers pass this.
   */
  stacked?: boolean;
}

interface FormDividerProps {
  label: string;
  className?: string;
}

/** Compact, label-left layout used by every data-entry form. */
export function FormGrid({ children, className }: FormGridProps) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

export function FormRow({
  label,
  children,
  required,
  hint,
  error,
  htmlFor,
  className,
  stacked,
}: FormRowProps) {
  return (
    <div
      className={cn(
        "grid gap-2",
        !stacked && "sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4",
        className,
      )}
    >
      <div className={cn(!stacked && "sm:pt-2")}>
        <Label htmlFor={htmlFor} className="text-sm text-muted-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      </div>
      <div className="min-w-0 space-y-1.5">
        {children}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

export function FormDivider({ label, className }: FormDividerProps) {
  return (
    <div className={cn("border-t pt-4", className)}>
      <h3 className="text-sm font-semibold text-foreground">{label}</h3>
    </div>
  );
}

