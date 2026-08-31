import { Loader2, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BulkAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  loading?: boolean;
}

export interface BulkActionToolbarProps {
  selectedCount: number;
  entityLabel: string;
  actions: BulkAction[];
  onClear: () => void;
  className?: string;
}

export function BulkActionToolbar({
  selectedCount,
  entityLabel,
  actions,
  onClear,
  className,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3",
        className
      )}
    >
      <span className="text-sm font-medium text-foreground">
        {selectedCount} {entityLabel}
        {selectedCount > 1 ? "s" : ""} selected
      </span>

      <div className="flex gap-2 ml-auto flex-wrap">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              size="sm"
              variant="outline"
              disabled={action.loading}
              onClick={action.onClick}
              className="gap-1.5"
            >
              {action.loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {action.label}
            </Button>
          );
        })}

        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className="text-muted-foreground"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      </div>
    </div>
  );
}
