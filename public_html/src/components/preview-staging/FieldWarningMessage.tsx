import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldWarningMessageProps {
  /** The validation or warning text to display beneath the field. */
  message: string;
  /**
   * Controls the color treatment.
   * - `'error'`   → `text-destructive` (red)  — use when the field blocks submission
   * - `'warning'` → `text-amber-600`  (amber) — use for non-blocking advisories
   * @default 'warning'
   */
  variant?: "error" | "warning";
}

export function FieldWarningMessage({
  message,
  variant = "warning",
}: FieldWarningMessageProps) {
  return (
    <p
      role="alert"
      aria-live="polite"
      className={cn(
        "text-xs flex items-start gap-1",
        variant === "error" ? "text-destructive" : "text-amber-600"
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

export default FieldWarningMessage;
