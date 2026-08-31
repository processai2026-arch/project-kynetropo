import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActiveFilterChipProps {
  /** The entity ID being filtered on. Pass an empty string when no entity filter is active. */
  filterEntityId: string;
  /** Human-readable entity type label (e.g. "lead", "property"). Pass "all" when not filtering by a specific type. */
  filterEntityType: string;
  /** Active category slug. Pass "all" when no category filter is active. */
  filterCategory: string;
  /** Fired when the user clicks the clear button. The parent is responsible for resetting all filter state. */
  onClear: () => void;
  /** Optional extra Tailwind classes applied to the chip wrapper. */
  className?: string;
}

function buildSummary(
  filterEntityId: string,
  filterEntityType: string,
  filterCategory: string
): string {
  const segments: string[] = ["Filtered"];

  if (filterEntityId) {
    const typeLabel =
      filterEntityType && filterEntityType !== "all"
        ? filterEntityType
        : "record";
    segments.push(`${typeLabel} #${filterEntityId}`);
  }

  if (filterCategory !== "all") {
    segments.push(filterCategory.replace(/_/g, " "));
  }

  return segments.join(" · ");
}

export function ActiveFilterChip({
  filterEntityId,
  filterEntityType,
  filterCategory,
  onClear,
  className,
}: ActiveFilterChipProps) {
  const isActive = !!filterEntityId || filterCategory !== "all";

  if (!isActive) return null;

  const summary = buildSummary(filterEntityId, filterEntityType, filterCategory);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-muted/50 pl-3 pr-1 py-1 text-xs text-muted-foreground",
        className
      )}
    >
      <span className="capitalize leading-none">{summary}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 rounded-full p-0 hover:bg-muted"
        onClick={onClear}
        aria-label="Clear all filters"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default ActiveFilterChip;
