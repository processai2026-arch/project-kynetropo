import { cn } from "@/lib/utils";

interface NativeFyYearSelectProps {
  value: number;
  onChange: (year: number) => void;
  years?: number[];
  className?: string;
  disabled?: boolean;
  id?: string;
}

const currentYear = new Date().getFullYear();
const DEFAULT_YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i);

export function NativeFyYearSelect({
  value,
  onChange,
  years = DEFAULT_YEARS,
  className,
  disabled = false,
  id,
}: NativeFyYearSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      disabled={disabled}
      className={cn(
        "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {years.map(y => (
        <option key={y} value={y}>
          FY {y}-{String(y + 1).slice(2)}
        </option>
      ))}
    </select>
  );
}
