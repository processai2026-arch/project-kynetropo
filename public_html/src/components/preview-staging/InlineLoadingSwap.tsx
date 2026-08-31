import { Loader2, type LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InlineLoadingSwapProps {
  isPending: boolean;
  idleIcon: LucideIcon;
  idleLabel: string;
  loadingLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}

export function InlineLoadingSwap({
  isPending,
  idleIcon: Icon,
  idleLabel,
  loadingLabel = "Saving...",
  onClick,
  disabled = false,
  variant = "default",
  size = "default",
  className,
}: InlineLoadingSwapProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={isPending || disabled}
      className={cn("gap-2", className)}
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <Icon className="h-4 w-4" />
          {idleLabel}
        </>
      )}
    </Button>
  );
}
