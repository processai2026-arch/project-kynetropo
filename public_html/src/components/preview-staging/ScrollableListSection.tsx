import { cn } from "@/lib/utils";

interface ScrollableListSectionProps {
  icon: React.ElementType;
  iconClassName?: string;
  label: string;
  count: number;
  emptyText?: string;
  children?: React.ReactNode;
}

export function ScrollableListSection({
  icon: Icon,
  iconClassName = "text-muted-foreground",
  label,
  count,
  emptyText = "Nothing to show",
  children,
}: ScrollableListSectionProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
        <Icon className={cn("h-4 w-4", iconClassName)} />
        {label} ({count})
      </h4>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {count === 0 && (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        )}
        {children}
      </div>
    </div>
  );
}
