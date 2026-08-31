import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SwitchLabelRowProps {
  /** Unique id wired to both the Switch and the Label's htmlFor */
  id: string;
  /** Human-readable text displayed beside the switch */
  label: string;
  /** Controlled checked state */
  checked: boolean;
  /** Fires with the new boolean value when the user toggles */
  onCheckedChange: (checked: boolean) => void;
}

export function SwitchLabelRow({
  id,
  label,
  checked,
  onCheckedChange,
}: SwitchLabelRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label
        htmlFor={id}
        className="text-sm text-foreground cursor-pointer select-none"
      >
        {label}
      </Label>
    </div>
  );
}

export default SwitchLabelRow;
