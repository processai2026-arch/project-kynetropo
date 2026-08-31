import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToggleTextButtonProps {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  onToggle: () => void;
  className?: string;
}

export function ToggleTextButton({
  active,
  activeLabel = "Mark done",
  inactiveLabel = "Reopen",
  onToggle,
  className,
}: ToggleTextButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onToggle}
      className={cn(
        active
          ? "text-muted-foreground hover:text-foreground"
          : "text-primary hover:text-primary/80",
        className
      )}
    >
      {active ? activeLabel : inactiveLabel}
    </Button>
  );
}
