import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface InlineMonthFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function InlineMonthFilter({
  label,
  value,
  onChange,
  className,
}: InlineMonthFilterProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-40"
      />
    </div>
  );
}
