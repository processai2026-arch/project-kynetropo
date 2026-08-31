import { cn } from "@/lib/utils";

interface FractionCountBadgeProps {
  done: number;
  total: number;
}

export function FractionCountBadge({ done, total }: FractionCountBadgeProps) {
  const open = total - done;

  return (
    <span
      className={cn(
        "text-xs font-semibold px-2.5 py-1 rounded-full",
        total === 0
          ? "bg-gray-100 text-gray-500"
          : open === 0
          ? "bg-emerald-100 text-emerald-700"
          : done === 0
          ? "bg-red-100 text-red-600"
          : "bg-orange-100 text-orange-700"
      )}
    >
      {open} / {total}
    </span>
  );
}
