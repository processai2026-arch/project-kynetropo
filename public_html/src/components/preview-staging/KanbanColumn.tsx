import { cn } from "@/lib/utils";

interface KanbanColumnProps<T> {
  title: string;
  titleBadge?: React.ReactNode;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyMessage?: string;
  accentClass?: string;
  className?: string;
}

export function KanbanColumn<T extends { id: string | number }>({
  title,
  titleBadge,
  items,
  renderItem,
  emptyMessage = "Empty",
  accentClass,
  className,
}: KanbanColumnProps<T>) {
  return (
    <div className={cn("rounded-xl border bg-card shadow-sm", accentClass && `border-t-4 ${accentClass}`, className)}>
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm text-card-foreground">{title}</h3>
        {titleBadge}
      </div>
      <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">{emptyMessage}</p>
        )}
        {items.map(item => renderItem(item))}
      </div>
    </div>
  );
}
