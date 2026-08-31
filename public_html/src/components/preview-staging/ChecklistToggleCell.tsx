import { CheckCircle2, Circle } from "lucide-react";

interface ChecklistToggleCellProps {
  /** Whether the checklist item is currently checked */
  isChecked: boolean;
  /** Called when the user clicks the cell to toggle the state */
  onToggle: () => void;
}

export function ChecklistToggleCell({ isChecked, onToggle }: ChecklistToggleCellProps) {
  return (
    <button
      type="button"
      className="mx-auto flex items-center justify-center rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity hover:opacity-70"
      onClick={onToggle}
      aria-pressed={isChecked}
      aria-label={isChecked ? "Mark as incomplete" : "Mark as complete"}
    >
      {isChecked ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

export default ChecklistToggleCell;
