import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRangePreset {
  label: string;
  from: string;
  to: string;
}

export interface DateRangeFilterBarWithPresetsProps {
  from: string;
  to: string;
  loading?: boolean;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onApply: (from: string, to: string) => void;
  presets?: DateRangePreset[];
}

export function DateRangeFilterBarWithPresets({
  from,
  to,
  loading = false,
  onFromChange,
  onToChange,
  onApply,
  presets = [],
}: DateRangeFilterBarWithPresetsProps) {
  return (
    <div className="bg-card rounded-xl border shadow-sm p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            value={from}
            onChange={e => onFromChange(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={to}
            onChange={e => onToChange(e.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={() => onApply(from, to)} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          {loading ? "Loading…" : "Apply"}
        </Button>
        {presets.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            {presets.map(p => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => onApply(p.from, p.to)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
