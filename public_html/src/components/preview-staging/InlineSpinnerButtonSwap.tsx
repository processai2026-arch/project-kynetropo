import type { ElementType } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

interface InlineSpinnerButtonSwapProps {
  activeKey: string | null;
  itemKey: string;
  idleIcon: ElementType;
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function InlineSpinnerButtonSwap({
  activeKey,
  itemKey,
  idleIcon: IdleIcon,
  label,
  onClick,
  variant = "outline",
  size = "sm",
  className,
}: InlineSpinnerButtonSwapProps) {
  const isActive = activeKey === itemKey;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={isActive}
      className={cn(className)}
    >
      {isActive ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <IdleIcon className="h-3.5 w-3.5 mr-1.5" />
      )}
      {label}
    </Button>
  );
}
