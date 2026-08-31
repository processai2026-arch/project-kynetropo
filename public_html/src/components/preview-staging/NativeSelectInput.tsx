import { cn } from "@/lib/utils";

export interface NativeSelectOption {
  label: string;
  value: string | number;
}

export interface NativeSelectInputProps {
  id: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: NativeSelectOption[];
  className?: string;
}

export function NativeSelectInput({
  id,
  value,
  onChange,
  options,
  className,
}: NativeSelectInputProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
