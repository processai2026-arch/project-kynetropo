import { cn } from "@/lib/utils";

interface FilterCountBadgeProps {
  count: number;
  className?: string;
}

export function FilterCountBadge({ count, className }: FilterCountBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
