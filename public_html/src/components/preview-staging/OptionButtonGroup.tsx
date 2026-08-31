import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OptionButtonGroupOption {
  value: string;
  label: string;
}

export interface OptionButtonGroupProps {
  /** Full list of choices to render */
  options: OptionButtonGroupOption[];
  /** Currently selected value */
  value: string;
  /** Called with the new value when a button is clicked */
  onChange: (value: string) => void;
  /** Optional extra classes applied to the wrapping div */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OptionButtonGroup({
  options,
  value,
  onChange,
  className,
}: OptionButtonGroupProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map(({ value: val, label }) => (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors",
            value === val
              ? "bg-primary text-primary-foreground border-primary"
              : "text-muted-foreground border-input hover:text-card-foreground hover:bg-muted/30"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default OptionButtonGroup;
