import { Label } from "@/components/ui/label";

interface CheckboxFilterGroupProps {
  /** Heading displayed above the checkbox row. */
  label?: string;
  /** Full list of values to render as checkboxes. */
  options: string[];
  /** Currently selected values. */
  selected: string[];
  /** Called with the toggled value — caller manages add/remove in its own state. */
  onToggle: (value: string) => void;
}

export function CheckboxFilterGroup({
  label,
  options,
  selected,
  onToggle,
}: CheckboxFilterGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <Label className="text-xs text-muted-foreground">{label}</Label>
      )}
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2 text-sm cursor-pointer select-none text-card-foreground"
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

export default CheckboxFilterGroup;
