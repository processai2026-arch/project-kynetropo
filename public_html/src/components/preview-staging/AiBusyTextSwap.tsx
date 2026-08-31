import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface AiBusyTextSwapProps {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  idleLabel: string;
  busyLabel: string;
  icon: LucideIcon;
  className?: string;
}

export function AiBusyTextSwap({
  busy,
  disabled = false,
  onClick,
  idleLabel,
  busyLabel,
  icon: Icon,
  className,
}: AiBusyTextSwapProps) {
  return (
    <Button
      variant="outline"
      disabled={busy || disabled}
      onClick={onClick}
      className={cn("gap-1.5", className)}
    >
      <Icon className="h-4 w-4" />
      {busy ? busyLabel : idleLabel}
    </Button>
  );
}
