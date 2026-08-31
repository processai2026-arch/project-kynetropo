import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InlineDateRangeFilterProps {
  fromDate: string;
  toDate: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  className?: string;
}

export function InlineDateRangeFilter({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  className,
}: InlineDateRangeFilterProps) {
  return (
    <div className={cn("flex gap-2 items-center", className)}>
      <Input
        type="date"
        value={fromDate}
        onChange={(e) => onFromChange(e.target.value)}
        className="w-40 text-sm"
      />
      <span className="text-muted-foreground text-sm">to</span>
      <Input
        type="date"
        value={toDate}
        onChange={(e) => onToChange(e.target.value)}
        className="w-40 text-sm"
      />
    </div>
  );
}
