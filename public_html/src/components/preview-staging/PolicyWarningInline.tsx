import { AlertTriangle } from "lucide-react";

interface PolicyWarningInlineProps {
  show: boolean;
  variant?: "full" | "icon-only" | "with-limit-label";
  categoryTotal?: number;
  policyLimit?: number;
}

export function PolicyWarningInline({
  show,
  variant = "full",
  categoryTotal,
  policyLimit,
}: PolicyWarningInlineProps) {
  if (!show) return null;

  if (variant === "icon-only") {
    return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  }

  if (variant === "with-limit-label") {
    return (
      <div className="flex items-center gap-1 text-xs text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Limit {policyLimit}</span>
      </div>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-amber-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      Category total {categoryTotal} exceeds {policyLimit}
    </span>
  );
}
