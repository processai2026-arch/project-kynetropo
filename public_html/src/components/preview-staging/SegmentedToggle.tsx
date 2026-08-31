import { cn } from "@/lib/utils";

export interface SegmentedOption {
  label: string;
  value: string;
}

export interface SegmentedToggleProps {
  /** List of selectable options */
  options: SegmentedOption[];
  /** Currently active value */
  value: string;
  /** Called with the new value when the user clicks a segment */
  onChange: (value: string) => void;
  /** Optional extra classes on the outer wrapper */
  className?: string;
}

export function SegmentedToggle({
  options,
  value,
  onChange,
  className,
}: SegmentedToggleProps) {
  return (
    <div className={cn("inline-flex rounded-full bg-muted p-1 text-sm", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-4 py-1.5 rounded-full font-medium transition-colors",
            value === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentedToggle;
