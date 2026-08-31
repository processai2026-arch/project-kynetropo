import type { ReactNode, ElementType } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SpinnerSwapButtonProps {
  loading: boolean;
  label: ReactNode;
  loadingLabel?: string;
  idleIcon?: ElementType;
  disabled?: boolean;
  onClick?: () => void;
  type?: "submit" | "button";
  className?: string;
}

export function SpinnerSwapButton({
  loading,
  label,
  loadingLabel = "Saving…",
  idleIcon: IdleIcon,
  disabled = false,
  onClick,
  type = "button",
  className,
}: SpinnerSwapButtonProps) {
  return (
    <Button
      type={type}
      disabled={loading || disabled}
      onClick={onClick}
      className={cn(className)}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          {loadingLabel}
        </>
      ) : (
        <>
          {IdleIcon && <IdleIcon className="h-4 w-4 mr-2" />}
          {label}
        </>
      )}
    </Button>
  );
}
