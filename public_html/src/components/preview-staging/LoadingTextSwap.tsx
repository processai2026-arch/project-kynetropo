import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadingTextSwapProps {
  busy: boolean;
  idleLabel: string;
  busyLabel: string;
  icon?: ReactNode;
  onClick?: () => void;
  variant?: "default" | "outline";
}

export function LoadingTextSwap({
  busy,
  idleLabel,
  busyLabel,
  icon,
  onClick,
  variant = "default",
}: LoadingTextSwapProps) {
  return (
    <Button
      onClick={onClick}
      disabled={busy}
      variant={variant}
      className={cn("gap-2", busy && "cursor-wait")}
    >
      {icon && icon}
      {busy ? busyLabel : idleLabel}
    </Button>
  );
}
