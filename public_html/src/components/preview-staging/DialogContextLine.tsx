import { cn } from "@/lib/utils";

interface DialogContextLineProps {
  primaryLabel: string;
  secondaryLabel: string;
  className?: string;
}

export function DialogContextLine({
  primaryLabel,
  secondaryLabel,
  className,
}: DialogContextLineProps) {
  return (
    <div className={cn("text-sm text-muted-foreground", className)}>
      {primaryLabel} from {secondaryLabel}
    </div>
  );
}
