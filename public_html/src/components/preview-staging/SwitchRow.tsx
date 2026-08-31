import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SwitchRowProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  description?: string;
  disabled?: boolean;
}

export function SwitchRow({ id, label, checked, onCheckedChange, description, disabled }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
