import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface CheckableLineItemRowProps {
  checked: boolean;
  onCheckedChange: () => void;
  label: string;
  referenceQty: number;
  referenceQtyLabel?: string;
  editableQty: number;
  editableQtyMax: number;
  editableQtyLabel?: string;
  onEditableQtyChange: (n: number) => void;
}

export function CheckableLineItemRow({
  checked,
  onCheckedChange,
  label,
  referenceQty,
  referenceQtyLabel = "Qty:",
  editableQty,
  editableQtyMax,
  editableQtyLabel = "damaged",
  onEditableQtyChange,
}: CheckableLineItemRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
        checked ? "bg-muted/40" : "hover:bg-muted/20",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onCheckedChange}
        className="h-4 w-4 shrink-0 rounded border-border accent-primary cursor-pointer"
      />
      <span className="flex-1 text-sm text-card-foreground truncate">{label}</span>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {referenceQtyLabel} {referenceQty}
      </span>
      <Input
        type="number"
        value={editableQty}
        min={1}
        max={editableQtyMax}
        onChange={(e) =>
          onEditableQtyChange(
            Math.min(Math.max(1, Number(e.target.value)), editableQtyMax),
          )
        }
        className="w-20 h-7 text-xs px-2"
        disabled={!checked}
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {editableQtyLabel}
      </span>
    </div>
  );
}
