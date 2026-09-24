import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/types/common";

/**
 * A table heading you can sort by.
 *
 * The icon is the whole point: an unsorted column shows the up-and-down chevron
 * pair so it reads as "this one is clickable", and the active column shows a
 * single arrow pointing the way the rows actually run. Rendering nothing until
 * a column is clicked hides the feature from anyone who has not already found
 * it.
 *
 * Sorting is server-side, so `sortKey` is a key the controller whitelisted in
 * its SORTABLE map — not a column name. Sending an unknown key is harmless;
 * ListQuery falls back to the page's default.
 */
export function SortableHeader({
  label,
  sortKey,
  activeSort,
  dir,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  /** Omit to render a plain, unsortable heading with matching styling. */
  sortKey?: string;
  activeSort?: string;
  dir?: SortDir;
  onSort?: (key: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const base = cn(
    "py-3 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground",
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
    className,
  );

  if (!sortKey || !onSort) {
    return <th className={base}>{label}</th>;
  }

  const active = activeSort === sortKey;
  const Icon = !active ? ChevronsUpDown : dir === "desc" ? ArrowDown : ArrowUp;

  return (
    <th className={cn(base, "p-0")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
        className={cn(
          "group flex w-full items-center gap-1 py-3 px-4 text-xs font-medium uppercase tracking-wider transition-colors",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {/* On a right-aligned column the label — not the sort chevron — must be
            the rightmost thing, so its edge lines up with the right-aligned
            numbers below it. The icon leads instead of trails. */}
        {align === "right" && (
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-opacity",
              active ? "opacity-100" : "opacity-40 group-hover:opacity-80",
            )}
          />
        )}
        <span className="truncate">{label}</span>
        {align !== "right" && (
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-opacity",
              active ? "opacity-100" : "opacity-40 group-hover:opacity-80",
            )}
          />
        )}
      </button>
    </th>
  );
}

export default SortableHeader;
