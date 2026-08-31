import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TagChip {
  label: string;
  className?: string;
}

export interface TagChipRowProps {
  chips: TagChip[];
  gap?: "sm" | "md" | "lg";
}

const gapClass: Record<NonNullable<TagChipRowProps["gap"]>, string> = {
  sm: "gap-1",
  md: "gap-2",
  lg: "gap-3",
};

export function TagChipRow({ chips, gap = "md" }: TagChipRowProps) {
  if (!chips.length) return null;

  return (
    <div className={cn("flex flex-wrap text-xs", gapClass[gap])}>
      {chips.map((chip) => (
        <Badge
          key={chip.label}
          variant="outline"
          className={cn("capitalize", chip.className)}
        >
          {chip.label}
        </Badge>
      ))}
    </div>
  );
}
