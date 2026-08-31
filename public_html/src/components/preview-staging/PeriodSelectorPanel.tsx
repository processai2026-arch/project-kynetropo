import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { CalendarRange } from "lucide-react";

export type PeriodPreset = "month" | "quarter" | "fy" | "custom";

const PRESET_LABELS: Record<PeriodPreset, string> = {
  month:   "This Month",
  quarter: "This Quarter",
  fy:      "Full FY",
  custom:  "Custom",
};

const PRESETS: PeriodPreset[] = ["month", "quarter", "fy", "custom"];

export interface PeriodSelectorPanelProps {
  from: string;
  to: string;
  activePeriod: PeriodPreset;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  onPresetChange: (preset: PeriodPreset) => void;
  summaryLabel?: string;
}

export function PeriodSelectorPanel({
  from,
  to,
  activePeriod,
  onFromChange,
  onToChange,
  onPresetChange,
  summaryLabel,
}: PeriodSelectorPanelProps) {
  const handleFromChange = (value: string) => {
    onFromChange(value);
    onPresetChange("custom");
  };

  const handleToChange = (value: string) => {
    onToChange(value);
    onPresetChange("custom");
  };

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(preset => (
          <button
            key={preset}
            type="button"
            onClick={() => onPresetChange(preset)}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
              activePeriod === preset
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {PRESET_LABELS[preset]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">From</span>
          <Input
            type="date"
            value={from}
            onChange={e => handleFromChange(e.target.value)}
            className="w-36 h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">To</span>
          <Input
            type="date"
            value={to}
            onChange={e => handleToChange(e.target.value)}
            className="w-36 h-8 text-xs"
          />
        </div>
        {summaryLabel && (
          <div className="flex items-center gap-1.5 pb-1">
            <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{summaryLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
