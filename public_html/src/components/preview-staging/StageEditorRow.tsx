import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/currency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentStage {
  stage_name: string;
  percentage: number | string;
  due_date: string;
}

export interface StageEditorRowProps {
  /** The payment stage data for this row */
  stage: PaymentStage;
  /** Called whenever a field value changes */
  onChange: (field: keyof PaymentStage, value: string) => void;
  /** Called when the user clicks the delete button */
  onRemove: () => void;
  /**
   * Optional pre-computed rupee amount for this stage.
   * Pass `null` or `undefined` to hide the hint entirely.
   */
  computedAmount?: number | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StageEditorRow({
  stage,
  onChange,
  onRemove,
  computedAmount,
}: StageEditorRowProps) {
  return (
    <div className="space-y-0.5">
      {/* 4-column grid: name | percentage | due-date | delete */}
      <div className="grid grid-cols-[1fr_80px_140px_32px] gap-2 items-center">

        {/* Stage name */}
        <Input
          value={stage.stage_name}
          onChange={(e) => onChange("stage_name", e.target.value)}
          placeholder="Stage name"
          className="text-sm"
        />

        {/* Percentage with % suffix */}
        <div className="relative">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={stage.percentage}
            onChange={(e) => onChange("percentage", e.target.value)}
            className="pr-6 text-sm"
            placeholder="0"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            %
          </span>
        </div>

        {/* Due date */}
        <Input
          type="date"
          value={stage.due_date}
          onChange={(e) => onChange("due_date", e.target.value)}
          className="text-sm"
        />

        {/* Delete */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove stage"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Computed amount hint — spans all 4 columns */}
      {computedAmount != null && (
        <p className="col-span-4 text-xs text-muted-foreground px-1">
          Amount: {inr(computedAmount, { decimals: true })}
        </p>
      )}
    </div>
  );
}

export default StageEditorRow;
