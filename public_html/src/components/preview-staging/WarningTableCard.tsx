import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WarningTableCardProps {
  title: string;
  countLabel: string;
  children: React.ReactNode;
  className?: string;
}

export function WarningTableCard({
  title,
  countLabel,
  children,
  className,
}: WarningTableCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border border-amber-200 shadow-sm", className)}>
      <div className="p-4 border-b border-amber-200 flex items-center gap-2 bg-amber-50 rounded-t-xl">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <h2 className="text-base font-semibold text-amber-900">{title}</h2>
        <span className="ml-auto text-xs text-amber-700">{countLabel}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
