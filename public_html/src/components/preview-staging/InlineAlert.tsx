import { cn } from "@/lib/utils";

interface InlineAlertProps {
  variant?: "info" | "warning" | "success" | "primary" | "error";
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

const VARIANT_STYLES: Record<string, string> = {
  primary: "bg-primary/5 border-primary/20 text-foreground",
  info: "bg-blue-50 border-blue-200 text-blue-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  success: "bg-emerald-50 border-emerald-200 text-emerald-700",
  error: "bg-red-50 border-red-200 text-red-700",
};

export function InlineAlert({ variant = "info", children, icon, className, action }: InlineAlertProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border rounded-xl px-4 py-3 text-sm",
        VARIANT_STYLES[variant],
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <div className="flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
