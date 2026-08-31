import { cn } from "@/lib/utils";

interface CategoryChipProps {
  label: string;
  className?: string;
}

export function CategoryChip({ label, className }: CategoryChipProps) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground whitespace-nowrap",
        className
      )}
    >
      {label}
    </span>
  );
}
