import type React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LoadingSpinnerButtonProps {
  loading: boolean;
  loadingLabel?: string;
  idleLabel: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
}

export function LoadingSpinnerButton({
  loading,
  loadingLabel,
  idleLabel,
  disabled = false,
  onClick,
  type = "button",
  variant = "default",
  size = "default",
  className,
}: LoadingSpinnerButtonProps) {
  return (
    <Button
      type={type}
      disabled={loading || disabled}
      onClick={onClick}
      variant={variant}
      size={size}
      className={cn(className)}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          {loadingLabel ?? "Saving…"}
        </>
      ) : (
        idleLabel
      )}
    </Button>
  );
}
