import { FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineDocumentIndicatorProps {
  visible: boolean;
  icon?: LucideIcon;
  label: string;
  className?: string;
}

export function InlineDocumentIndicator({
  visible,
  icon: Icon = FileText,
  label,
  className,
}: InlineDocumentIndicatorProps) {
  if (!visible) return null;

  return (
    <div className={cn("mt-0.5 flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}
