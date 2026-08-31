import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExpandableTableSubRowProps {
  entryId: number;
  expandedId: number | null;
  colSpan: number;
  subTitle: string;
  records: Array<unknown> | undefined;
  renderRecord: (r: unknown, index: number) => ReactNode;
  emptyText?: string;
  onToggle: (id: number) => void;
}

export function ExpandableTableSubRowToggle({
  entryId,
  expandedId,
  onToggle,
}: Pick<ExpandableTableSubRowProps, "entryId" | "expandedId" | "onToggle">) {
  const isOpen = expandedId === entryId;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      aria-label={isOpen ? "Collapse sub-row" : "Expand sub-row"}
      onClick={() => onToggle(entryId)}
    >
      {isOpen ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      )}
    </Button>
  );
}

export function ExpandableTableSubRow({
  entryId,
  expandedId,
  colSpan,
  subTitle,
  records,
  renderRecord,
  emptyText = "No records found",
  onToggle: _onToggle,
}: ExpandableTableSubRowProps) {
  if (expandedId !== entryId) return null;

  return (
    <tr className={cn("bg-muted/20")}>
      <td colSpan={colSpan} className="px-6 py-3 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          {subTitle}
        </p>
        {records === undefined ? (
          <p className="text-xs text-muted-foreground italic">Loading…</p>
        ) : records.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">{emptyText}</p>
        ) : (
          <div className="space-y-1">
            {records.map((r, i) => renderRecord(r, i))}
          </div>
        )}
      </td>
    </tr>
  );
}
