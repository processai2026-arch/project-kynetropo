import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectedItemChipProps {
  label: string;
  onClear: () => void;
}

export function SelectedItemChip({ label, onClear }: SelectedItemChipProps) {
  return (
    <div
      className={cn(
        "h-8 flex items-center gap-1.5 px-2",
        "border border-input rounded-md bg-background text-xs"
      )}
    >
      <span className="flex-1 truncate text-card-foreground font-medium">
        {label}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
        title="Clear selection"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
