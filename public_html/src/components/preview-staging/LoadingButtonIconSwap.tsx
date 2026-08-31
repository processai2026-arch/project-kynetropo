import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadingButtonIconSwapProps {
  isLoading: boolean;
  idleIcon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "outline";
  disabled?: boolean;
}

export function LoadingButtonIconSwap({
  isLoading,
  idleIcon,
  label,
  onClick,
  variant = "default",
  disabled = false,
}: LoadingButtonIconSwapProps) {
  return (
    <Button
      onClick={onClick}
      disabled={isLoading || disabled}
      variant={variant}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        idleIcon
      )}
      {label}
    </Button>
  );
}
