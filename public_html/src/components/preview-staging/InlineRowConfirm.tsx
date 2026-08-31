import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface InlineRowConfirmProps {
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
}

export function InlineRowConfirm({
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  className,
}: InlineRowConfirmProps) {
  if (!isOpen) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">Are you sure?</span>
      <Button
        size="sm"
        variant="destructive"
        disabled={isLoading}
        onClick={onConfirm}
      >
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          confirmLabel
        )}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isLoading}
        onClick={onCancel}
      >
        {cancelLabel}
      </Button>
    </div>
  );
}
