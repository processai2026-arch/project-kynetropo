import { ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";

interface GroupedGallerySectionProps<T> {
  items: T[];
  getGroupKey: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  sortKey?: keyof T;
}

export function GroupedGallerySection<T>({
  items,
  getGroupKey,
  renderCard,
  sortKey,
}: GroupedGallerySectionProps<T>) {
  const grouped = useMemo(() => {
    const sorted = sortKey
      ? [...items].sort((a, b) => {
          const av = a[sortKey];
          const bv = b[sortKey];
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return String(bv).localeCompare(String(av));
        })
      : [...items];

    return sorted.reduce<Record<string, T[]>>((acc, item) => {
      const key = getGroupKey(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [items, getGroupKey, sortKey]);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No items found
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([groupName, groupItems], gi) => (
        <div key={groupName} className={cn(gi > 0 && "border-t pt-4")}>
          <h4 className="text-sm font-semibold text-muted-foreground mb-2">
            {groupName}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {groupItems.map(renderCard)}
          </div>
        </div>
      ))}
    </div>
  );
}
