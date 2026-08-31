import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface NativeSelectOption {
  value: string;
  label: string;
}

interface NativeSelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: NativeSelectOption[];
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function NativeSelectField({
  label,
  value,
  onChange,
  options,
  id,
  placeholder,
  disabled = false,
  className,
}: NativeSelectFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
