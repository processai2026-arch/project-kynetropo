import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface TruncatedListWithOverflowProps {
  items: string[];
  limit?: number;
  className?: string;
}

export function TruncatedListWithOverflow({
  items,
  limit = 3,
  className,
}: TruncatedListWithOverflowProps) {
  const visible = items.slice(0, limit);
  const overflow = items.length - limit;

  return (
    <td className={cn("py-3 px-4 text-xs max-w-[200px]", className)}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-muted-foreground truncate">
          {visible.join(", ")}
        </span>
        {overflow > 0 && (
          <Badge className="shrink-0 border bg-muted text-muted-foreground">
            +{overflow} more
          </Badge>
        )}
      </div>
    </td>
  );
}
