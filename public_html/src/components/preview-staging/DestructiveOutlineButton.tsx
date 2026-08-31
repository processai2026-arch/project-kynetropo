import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DestructiveOutlineButtonProps {
  label: string;
  icon?: ElementType;
  onClick: () => void;
  disabled?: boolean;
}

export function DestructiveOutlineButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
}: DestructiveOutlineButtonProps) {
  return (
    <Button
      variant="outline"
      className={cn(
        "text-destructive hover:bg-destructive/10 hover:text-destructive"
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {label}
    </Button>
  );
}
