import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface SwitchToggleRowProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function SwitchToggleRow({ id, label, checked, onCheckedChange }: SwitchToggleRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
      <Label
        htmlFor={id}
        className="text-sm text-card-foreground cursor-pointer select-none"
      >
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export default SwitchToggleRow;
