import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface CollapsibleFilterPanelProps {
  show: boolean;
  statuses: string[];
  activeStatuses: string[];
  onToggleStatus: (status: string) => void;
  switchChecked: boolean;
  onSwitchChange: (value: boolean) => void;
  switchLabel: string;
  className?: string;
}

export function CollapsibleFilterPanel({
  show,
  statuses,
  activeStatuses,
  onToggleStatus,
  switchChecked,
  onSwitchChange,
  switchLabel,
  className,
}: CollapsibleFilterPanelProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-4 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <div className="flex flex-wrap gap-3">
          {statuses.map((s) => {
            const checked = activeStatuses.includes(s);
            return (
              <label
                key={s}
                className={cn(
                  "flex items-center gap-1.5 text-sm cursor-pointer select-none",
                  checked ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleStatus(s)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
                <span className="capitalize">{s.replace(/_/g, " ")}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:border-l sm:border-border sm:pl-8">
        <Switch
          id="collapsible-filter-switch"
          checked={switchChecked}
          onCheckedChange={onSwitchChange}
        />
        <Label
          htmlFor="collapsible-filter-switch"
          className="text-sm cursor-pointer"
        >
          {switchLabel}
        </Label>
      </div>
    </div>
  );
}
