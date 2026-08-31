import { cn } from "@/lib/utils";

interface MutedLabelChipProps {
  label: string;
  className?: string;
}

export function MutedLabelChip({ label, className }: MutedLabelChipProps) {
  return (
    <span
      className={cn(
        "text-xs font-medium capitalize px-2 py-0.5 bg-muted rounded text-muted-foreground shrink-0",
        className
      )}
    >
      {label}
    </span>
  );
}
