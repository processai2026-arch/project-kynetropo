import { cn } from "@/lib/utils";

interface FieldCountLabelProps {
  selectedCount?: number;
  totalCount?: number;
  className?: string;
}

export function FieldCountLabel({
  selectedCount = 0,
  totalCount = 0,
  className,
}: FieldCountLabelProps) {
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {selectedCount}/{totalCount} fields
    </span>
  );
}
