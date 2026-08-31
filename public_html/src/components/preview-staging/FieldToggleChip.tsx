import { cn } from "@/lib/utils";

interface FieldToggleChipProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

export function FieldToggleChip({ label, checked, onChange }: FieldToggleChipProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors text-sm",
        checked
          ? "bg-primary/5 border-primary/30 text-foreground"
          : "border-border text-muted-foreground hover:bg-muted/30"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded"
      />
      <span>{label}</span>
    </label>
  );
}
