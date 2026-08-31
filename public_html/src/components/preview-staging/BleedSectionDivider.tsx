import { cn } from "@/lib/utils";

interface BleedSectionDividerProps {
  label: string;
  bleedSize?: number;
}

const bleedClasses: Record<number, string> = {
  4: "-mx-4 px-4",
  5: "-mx-5 px-5",
  6: "-mx-6 px-6",
  8: "-mx-8 px-8",
};

export function BleedSectionDivider({ label, bleedSize = 6 }: BleedSectionDividerProps) {
  return (
    <div className={cn("py-2 border-b bg-muted/30 mb-2", bleedClasses[bleedSize] ?? "-mx-6 px-6")}>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
