import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface BulkCheckboxHeaderCellProps {
  allSelected: boolean;
  someSelected?: boolean;
  onToggleAll: () => void;
}

export interface BulkCheckboxRowProps {
  rowSelected: boolean;
  onToggleRow: () => void;
  rowLabel: string;
  children?: React.ReactNode;
}

function HeaderCell({
  allSelected,
  someSelected = false,
  onToggleAll,
}: BulkCheckboxHeaderCellProps) {
  const checked: boolean | "indeterminate" = allSelected
    ? true
    : someSelected
    ? "indeterminate"
    : false;

  return (
    <th className="px-4 py-3 w-10">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggleAll}
        aria-label="Select all"
      />
    </th>
  );
}

function Row({
  rowSelected,
  onToggleRow,
  rowLabel,
  children,
}: BulkCheckboxRowProps) {
  return (
    <tr
      className={cn(
        "border-t hover:bg-muted/30 transition-colors",
        rowSelected && "bg-primary/5"
      )}
    >
      <td className="px-4 py-3">
        <Checkbox
          checked={rowSelected}
          onCheckedChange={onToggleRow}
          aria-label={rowLabel}
        />
      </td>
      {children}
    </tr>
  );
}

export const BulkCheckboxPair = { HeaderCell, Row };

export function useBulkSelection<T extends { id: number | string }>(
  items: T[]
) {
  const [selectedIds, setSelectedIds] = React.useState<Set<T["id"]>>(
    new Set()
  );

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () =>
    setSelectedIds(
      allSelected ? new Set() : new Set(items.map((i) => i.id))
    );

  const toggleRow = (id: T["id"]) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const isSelected = (id: T["id"]) => selectedIds.has(id);
  const clearSelection = () => setSelectedIds(new Set());

  return {
    selectedIds,
    allSelected,
    someSelected,
    toggleAll,
    toggleRow,
    isSelected,
    clearSelection,
  };
}
