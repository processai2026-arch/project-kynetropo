import { ScrollableX } from "@/components/ui/scrollable-x";
import { cn } from "@/lib/utils";

interface TableCardProps {
  children: React.ReactNode;
  filterBar?: React.ReactNode;
  className?: string;
  useScrollableX?: boolean;
}

export function TableCard({ children, filterBar, className, useScrollableX = true }: TableCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border shadow-sm", className)}>
      {filterBar && <div className="p-4 border-b">{filterBar}</div>}
      <div className="p-4">
        {useScrollableX ? (
          <ScrollableX>{children}</ScrollableX>
        ) : (
          <div className="overflow-x-auto eco-float-scroll">{children}</div>
        )}
      </div>
    </div>
  );
}
