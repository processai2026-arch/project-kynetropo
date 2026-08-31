import { cn } from "@/lib/utils";

interface InlineLabelValueGridProps {
  fields: [string, string | null | undefined][];
  cols?: 1 | 2 | 3;
}

const colsClass: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

export function InlineLabelValueGrid({ fields, cols = 2 }: InlineLabelValueGridProps) {
  return (
    <div className={cn("grid gap-2 text-sm", colsClass[cols])}>
      {fields.map(([label, value]) => (
        <div key={label}>
          <span className="text-muted-foreground">{label}: </span>
          <span className="text-card-foreground">{value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}
