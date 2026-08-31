import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface PercentageInputWithSuffixProps {
  value: number | string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function PercentageInputWithSuffix({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.5,
  disabled = false,
  placeholder,
  className,
  id,
}: PercentageInputWithSuffixProps) {
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="pr-8"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 select-none text-xs text-muted-foreground"
      >
        %
      </span>
    </div>
  );
}

export default PercentageInputWithSuffix;
