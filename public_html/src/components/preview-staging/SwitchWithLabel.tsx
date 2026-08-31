import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SwitchWithLabelProps {
  /** Current toggle state */
  checked: boolean;
  /** Called with the new boolean value when the user toggles */
  onCheckedChange: (value: boolean) => void;
  /** Text shown to the right of the switch */
  label: string;
  /** Optional HTML id wired to the Switch; auto-derived from label when omitted */
  id?: string;
  /** When true the switch and label are rendered at reduced opacity and pointer-events are suppressed */
  disabled?: boolean;
}

export function SwitchWithLabel({
  checked,
  onCheckedChange,
  label,
  id,
  disabled = false,
}: SwitchWithLabelProps) {
  const switchId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div
      className={[
        "flex items-center gap-3",
        disabled ? "opacity-50 pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Switch
        id={switchId}
        checked={!!checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
      <Label
        htmlFor={switchId}
        className="text-sm text-card-foreground cursor-pointer select-none"
      >
        {label}
      </Label>
    </div>
  );
}

export default SwitchWithLabel;
