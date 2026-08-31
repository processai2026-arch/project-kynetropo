import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear?: () => void;
  fromLabel?: string;
  toLabel?: string;
  showClear?: boolean;
  className?: string;
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  onClear,
  fromLabel = "From",
  toLabel = "To",
  showClear = true,
  className,
}: DateRangePickerProps) {
  const hasDates = !!(from || to);
  return (
    <div className={`flex flex-wrap items-end gap-3${className ? ` ${className}` : ""}`}>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">{fromLabel}</Label>
        <Input type="date" value={from} onChange={e => onFromChange(e.target.value)} className="h-8 w-36 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">{toLabel}</Label>
        <Input type="date" value={to} onChange={e => onToChange(e.target.value)} className="h-8 w-36 text-sm" />
      </div>
      {showClear && hasDates && onClear && (
        <Button variant="ghost" size="sm" className="text-xs h-8" onClick={onClear}>
          <X className="h-3 w-3 mr-1" />Clear
        </Button>
      )}
    </div>
  );
}
