import { cn } from "@/lib/utils";

interface SectionCountSuffixProps {
  count: number;
  className?: string;
}

export function SectionCountSuffix({ count, className }: SectionCountSuffixProps) {
  return (
    <span className={cn("text-xs text-muted-foreground font-normal", className)}>
      ({count})
    </span>
  );
}
