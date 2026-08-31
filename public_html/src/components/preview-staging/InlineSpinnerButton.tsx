import { Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InlineSpinnerButtonProps {
  loading: boolean;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  variant?: "outline" | "default" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
}

export function InlineSpinnerButton({
  loading,
  icon: Icon,
  label,
  onClick,
  variant = "outline",
  size = "default",
  className,
}: InlineSpinnerButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      disabled={loading}
      onClick={onClick}
      className={cn("gap-2", className)}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
