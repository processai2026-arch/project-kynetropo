import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface PermissionItem {
  key: string;
  label: string;
}

interface CheckboxPermissionGridProps {
  label: string;
  items: PermissionItem[];
  selected: string[];
  onToggle: (key: string) => void;
  helperText?: string;
  maxHeight?: string;
}

export function CheckboxPermissionGrid({
  label,
  items,
  selected,
  onToggle,
  helperText,
  maxHeight,
}: CheckboxPermissionGridProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div
        className={cn(
          "grid grid-cols-2 gap-1.5 border rounded-lg p-3 overflow-y-auto",
          maxHeight ?? "max-h-52"
        )}
      >
        {items.map((m) => (
          <label
            key={m.key}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.includes(m.key)}
              onChange={() => onToggle(m.key)}
              className="rounded"
            />
            <span className="text-card-foreground">{m.label}</span>
          </label>
        ))}
      </div>
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
