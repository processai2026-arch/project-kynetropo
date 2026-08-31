import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AmountRangeFilterProps {
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  currency?: string;
  className?: string;
}

const stripLeadingZeros = (value: string) => value.replace(/^0+(?=\d)/, "");

export function AmountRangeFilter({
  min,
  max,
  onMinChange,
  onMaxChange,
  currency = "₹",
  className,
}: AmountRangeFilterProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        type="number"
        placeholder={`Min ${currency}`}
        value={min}
        min={0}
        onChange={e => onMinChange(stripLeadingZeros(e.target.value))}
      />
      <Input
        type="number"
        placeholder={`Max ${currency}`}
        value={max}
        min={0}
        onChange={e => onMaxChange(stripLeadingZeros(e.target.value))}
      />
    </div>
  );
}
