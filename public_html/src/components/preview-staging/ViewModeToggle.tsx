import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ViewModeOption<T extends string = string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

export interface ViewModeToggleProps<T extends string = string> {
  viewMode: T;
  onChangeViewMode: (mode: T) => void;
  options: ViewModeOption<T>[];
}

export function ViewModeToggle<T extends string = string>({
  viewMode,
  onChangeViewMode,
  options,
}: ViewModeToggleProps<T>) {
  return (
    <div className="flex items-center border border-border rounded-lg overflow-hidden ml-auto shrink-0">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChangeViewMode(value)}
          aria-pressed={viewMode === value}
          className={cn(
            "px-3 py-2 text-sm flex items-center gap-1.5 transition-colors select-none",
            viewMode === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default ViewModeToggle;
