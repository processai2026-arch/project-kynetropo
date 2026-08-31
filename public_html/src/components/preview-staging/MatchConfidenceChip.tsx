import { cn } from "@/lib/utils";

interface MatchConfidenceChipProps {
  isExact: boolean;
  isClose: boolean;
  isFirst: boolean;
}

export function MatchConfidenceChip({
  isExact,
  isClose,
  isFirst,
}: MatchConfidenceChipProps) {
  if (!isFirst || (!isExact && !isClose)) return null;

  return (
    <span
      className={cn(
        "text-xs px-1.5 py-0.5 rounded",
        isExact
          ? "bg-emerald-100 text-emerald-700 font-medium"
          : "bg-amber-100 text-amber-700"
      )}
    >
      {isExact ? "Best match" : "Close"}
    </span>
  );
}
