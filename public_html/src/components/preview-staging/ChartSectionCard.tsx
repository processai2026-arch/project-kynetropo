import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartSectionCardProps {
  /** Lucide icon component to display in the header. */
  icon: LucideIcon;
  /** Card heading text. */
  title: string;
  /** When true, renders the emptyMessage instead of children. */
  isEmpty: boolean;
  /** Message shown centred in the chart area when isEmpty is true. */
  emptyMessage: string;
  /** Chart content — rendered only when isEmpty is false. */
  children?: React.ReactNode;
  /** Optional extra classes on the outer card wrapper. */
  className?: string;
}

export function ChartSectionCard({
  icon: Icon,
  title,
  isEmpty,
  emptyMessage,
  children,
  className,
}: ChartSectionCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border p-4 shadow-sm", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          {emptyMessage}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export default ChartSectionCard;
