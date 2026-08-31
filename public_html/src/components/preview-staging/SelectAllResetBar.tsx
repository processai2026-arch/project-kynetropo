import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SelectAllResetBarProps {
  label?: string;
  onSelectAll: () => void;
  onResetDefault: () => void;
  className?: string;
}

export function SelectAllResetBar({
  label = "Options",
  onSelectAll,
  onResetDefault,
  className,
}: SelectAllResetBarProps) {
  return (
    <div className={cn("flex items-center gap-2 mb-2", className)}>
      <span className="text-sm font-medium text-card-foreground">{label}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={onSelectAll}
      >
        Select All
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={onResetDefault}
      >
        Reset Default
      </Button>
    </div>
  );
}
