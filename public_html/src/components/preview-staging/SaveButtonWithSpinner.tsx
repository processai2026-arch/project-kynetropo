import { Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

export interface SaveButtonWithSpinnerProps
  extends VariantProps<typeof buttonVariants> {
  saving: boolean;
  label: string;
  savingLabel?: string;
  className?: string;
}

export function SaveButtonWithSpinner({
  saving,
  label,
  savingLabel = "Saving…",
  variant,
  size,
  className,
}: SaveButtonWithSpinnerProps) {
  return (
    <Button
      type="submit"
      disabled={saving}
      variant={variant}
      size={size}
      className={cn(className)}
    >
      {saving ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          {savingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
