import { cn } from "@/lib/utils";

export interface ToggleOption {
  value: string;
  label: string;
}

export interface ChannelTogglePickerProps {
  /** The currently selected option value */
  value: string;
  /** Called with the new value when either button is clicked */
  onChange: (value: string) => void;
  /** First toggle option */
  optionA: ToggleOption;
  /** Second toggle option */
  optionB: ToggleOption;
}

export function ChannelTogglePicker({
  value,
  onChange,
  optionA,
  optionB,
}: ChannelTogglePickerProps) {
  const renderButton = (option: ToggleOption) => {
    const selected = value === option.value;
    return (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        aria-pressed={selected}
        className={cn(
          "flex-1 py-2 rounded-md text-sm font-medium border transition-colors",
          selected
            ? "bg-primary text-primary-foreground border-primary"
            : "border-border text-muted-foreground hover:text-card-foreground"
        )}
      >
        {option.label}
      </button>
    );
  };

  return (
    <div className="flex gap-2" role="group">
      {renderButton(optionA)}
      {renderButton(optionB)}
    </div>
  );
}

export default ChannelTogglePicker;
