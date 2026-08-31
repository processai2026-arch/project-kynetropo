import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateRangeFilterPanelProps {
  fromDate: string;
  toDate: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  className?: string;
}

export function DateRangeFilterPanel({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  className,
}: DateRangeFilterPanelProps) {
  return (
    <div className={cn("bg-card rounded-xl border shadow-sm p-4", className)}>
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-1.5">
          <Label htmlFor="date-from">From Date</Label>
          <Input
            id="date-from"
            type="date"
            value={fromDate}
            onChange={(e) => onFromChange(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date-to">To Date</Label>
          <Input
            id="date-to"
            type="date"
            value={toDate}
            onChange={(e) => onToChange(e.target.value)}
            className="w-40"
          />
        </div>
      </div>
    </div>
  );
}
