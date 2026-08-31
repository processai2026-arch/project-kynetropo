import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AiAutofillButtonProps {
  loading: boolean;
  onClick: () => void;
  label?: string;
  className?: string;
}

export function AiAutofillButton({
  loading,
  onClick,
  label = "Auto-fill from photo",
  className,
}: AiAutofillButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      className={cn("flex-1", className)}
      disabled={loading}
      onClick={onClick}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
